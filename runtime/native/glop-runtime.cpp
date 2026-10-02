#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>
#include <algorithm>
#include <cmath>

namespace glop {

struct Chunk;
struct Function;
struct Array;
struct Object;

using Value = std::variant<std::monostate, bool, double, std::string,
                           std::shared_ptr<Function>, std::shared_ptr<Array>,
                           std::shared_ptr<Object>>;

struct Instruction { uint8_t op; int32_t arg; uint8_t argType; std::string text; };
struct Chunk { uint32_t arity{}; std::string name; std::vector<std::string> freeNames; std::unordered_map<std::string,uint32_t> localNames; std::vector<Value> constants; std::vector<std::shared_ptr<Chunk>> functions; std::vector<Instruction> code; };
struct Cell { Value value; };
struct Function { std::shared_ptr<Chunk> chunk; std::vector<std::shared_ptr<Cell>> freeCells; };
struct Array { std::vector<Value> values; };
struct Object { std::unordered_map<std::string, Value> values; };

static uint32_t readU32(std::istream& in){uint8_t b[4];in.read((char*)b,4);if(!in)throw std::runtime_error("truncated GBC");return uint32_t(b[0])|(uint32_t(b[1])<<8)|(uint32_t(b[2])<<16)|(uint32_t(b[3])<<24);}
static int32_t readI32(std::istream& in){return (int32_t)readU32(in);}
static uint8_t readU8(std::istream& in){uint8_t b;in.read((char*)&b,1);if(!in)throw std::runtime_error("truncated GBC");return b;}
static double readF64(std::istream& in){double d;in.read((char*)&d,8);if(!in)throw std::runtime_error("truncated GBC");return d;}
static std::string readString(std::istream& in){auto n=readU32(in);std::string s(n,'\0');in.read(s.data(),n);if(!in)throw std::runtime_error("truncated GBC");return s;}

static Value readValue(std::istream& in){
  switch(readU8(in)){
    case 0:return std::monostate{};
    case 1:return false;
    case 2:return true;
    case 3:return readF64(in);
    case 4:return readString(in);
    default:throw std::runtime_error("bad constant type");
  }
}

static Instruction readInstruction(std::istream& in){
  Instruction x; x.op=readU8(in); x.argType=readU8(in);
  if(x.argType==0)x.arg=0;
  else if(x.argType==1)x.arg=readI32(in);
  else if(x.argType==2)x.text=readString(in);
  else throw std::runtime_error("bad instruction argument type");
  return x;
}

static std::shared_ptr<Chunk> readChunk(std::istream& in){
  auto c=std::make_shared<Chunk>(); c->arity=readU32(in); c->name=readString(in); auto nfrees=readU32(in); for(uint32_t i=0;i<nfrees;i++)c->freeNames.push_back(readString(in)); auto nlocals=readU32(in); for(uint32_t i=0;i<nlocals;i++){auto idx=readU32(in);c->localNames[readString(in)]=idx;}
  auto nc=readU32(in); for(uint32_t i=0;i<nc;i++)c->constants.push_back(readValue(in));
  auto nf=readU32(in); for(uint32_t i=0;i<nf;i++)c->functions.push_back(readChunk(in));
  auto ni=readU32(in); for(uint32_t i=0;i<ni;i++)c->code.push_back(readInstruction(in));
  return c;
}

static std::shared_ptr<Chunk> load(const std::string& file){
  std::ifstream in(file,std::ios::binary); if(!in)throw std::runtime_error("cannot open "+file);
  char magic[4];in.read(magic,4);if(std::memcmp(magic,"GBC2",4)!=0)throw std::runtime_error("not a GLOP bytecode file");
  if(readU8(in)!=2)throw std::runtime_error("unsupported GBC version");
  return readChunk(in);
}

static bool truthy(const Value& v){
  if(std::holds_alternative<std::monostate>(v))return false;
  if(auto p=std::get_if<bool>(&v))return *p;
  if(auto p=std::get_if<double>(&v))return *p!=0;
  if(auto p=std::get_if<std::string>(&v))return !p->empty();
  return true;
}

static std::string display(const Value& v){
  if(std::holds_alternative<std::monostate>(v))return "VOID";
  if(auto p=std::get_if<bool>(&v))return *p?"BASED":"CAP";
  if(auto p=std::get_if<double>(&v)){if(std::isfinite(*p)&&std::floor(*p)==*p)return std::to_string((long long)*p);return std::to_string(*p);}
  if(auto p=std::get_if<std::string>(&v))return *p;
  if(auto p=std::get_if<std::shared_ptr<Array>>(&v)){std::string s="[";for(size_t i=0;i<(*p)->values.size();i++){if(i)s+=", ";s+=display((*p)->values[i]);}return s+"]";}
  if(auto p=std::get_if<std::shared_ptr<Object>>(&v)){std::string s="{",sep="";for(const auto&[k,val]:(*p)->values){s+=sep+k+":"+display(val);sep=", ";}return s+"}";}
  return "[function]";
}

enum : uint8_t {
 CONST,LOAD_GLOBAL,STORE_GLOBAL,LOAD_LOCAL,STORE_LOCAL,LOAD_FREE,STORE_FREE,
 MAKE_FUNCTION,MAKE_CLOSURE,CALL,RETURN,MAKE_ARRAY,MAKE_OBJECT,GET_INDEX,SET_INDEX,
 GET_MEMBER,SET_MEMBER,SETUP_CATCH,POP_CATCH,THROW,ADD,SUB,MUL,DIV,MOD,EQ,NE,LT,LTE,GT,GTE,
 NOT,NEG,JUMP,JUMP_IF_FALSE,JUMP_IF_TRUE,PRINT,POP,HALT
};

struct Frame { std::shared_ptr<Chunk> chunk; size_t ip{}; std::vector<std::shared_ptr<Cell>> locals; std::vector<std::shared_ptr<Cell>> freeCells; };
struct Handler { size_t frameIndex{}; size_t target{}; size_t stackDepth{}; };

class VM {
  std::shared_ptr<Chunk> root;
  std::vector<Value> stack;
  std::vector<Frame> frames;
  std::vector<Handler> handlers;
  std::shared_ptr<Cell> capture(const Frame& f,const std::string& name){auto it=f.chunk->localNames.find(name);if(it!=f.chunk->localNames.end()){auto i=it->second;if(i>=f.locals.size())throw std::runtime_error("invalid captured local");return f.locals[i];}for(size_t i=0;i<f.chunk->freeNames.size();++i)if(f.chunk->freeNames[i]==name){if(i>=f.freeCells.size())throw std::runtime_error("invalid captured free");return f.freeCells[i];}throw std::runtime_error("cannot capture lexical name: "+name);}
  std::shared_ptr<Function> makeFunction(const Frame& f,std::shared_ptr<Chunk> c){auto fn=std::make_shared<Function>();fn->chunk=std::move(c);for(const auto& n:fn->chunk->freeNames)fn->freeCells.push_back(capture(f,n));return fn;}
  std::unordered_map<std::string,Value> globals;

  void raise(Value error){
    while(!handlers.empty()){
      Handler h=handlers.back(); handlers.pop_back();
      while(frames.size()>h.frameIndex+1) frames.pop_back();
      if(frames.empty()) break;
      auto &f=frames.back(); f.ip=h.target;
      if(stack.size()>h.stackDepth) stack.resize(h.stackDepth);
      push(std::move(error)); return;
    }
    throw std::runtime_error("unhandled OOPSIE: "+display(error));
  }

  Value pop(){if(stack.empty())throw std::runtime_error("GLOP stack underflow");auto v=stack.back();stack.pop_back();return v;}
  void push(Value v){stack.push_back(std::move(v));}
  double number(const Value& v){if(auto p=std::get_if<double>(&v))return *p;throw std::runtime_error("expected number");}
  bool equal(const Value&a,const Value&b){
    if(a.index()!=b.index()) return false;
    if(std::holds_alternative<std::monostate>(a)) return true;
    if(auto p=std::get_if<bool>(&a)) return *p==std::get<bool>(b);
    if(auto p=std::get_if<double>(&a)) return *p==std::get<double>(b);
    if(auto p=std::get_if<std::string>(&a)) return *p==std::get<std::string>(b);
    if(auto p=std::get_if<std::shared_ptr<Function>>(&a)) return *p==std::get<std::shared_ptr<Function>>(b);
    if(auto p=std::get_if<std::shared_ptr<Array>>(&a)) return *p==std::get<std::shared_ptr<Array>>(b);
    if(auto p=std::get_if<std::shared_ptr<Object>>(&a)) return *p==std::get<std::shared_ptr<Object>>(b);
    return false;
  }
  Value binary(uint8_t op,Value a,Value b){
    if(op==ADD && std::holds_alternative<std::string>(a) && std::holds_alternative<std::string>(b))return std::get<std::string>(a)+std::get<std::string>(b);
    double x=number(a),y=number(b);
    switch(op){case ADD:return x+y;case SUB:return x-y;case MUL:return x*y;case DIV:if(y==0)throw std::runtime_error("division by zero");return x/y;case MOD:if(y==0)throw std::runtime_error("modulo by zero");return std::fmod(x,y);}
    throw std::runtime_error("bad arithmetic opcode");
  }

public:
  explicit VM(std::shared_ptr<Chunk> c):root(std::move(c)){}
  Value run(){
    frames.push_back({root,0,{}, {}});
    while(!frames.empty()){
      auto &f=frames.back();
      if(f.ip>=f.chunk->code.size())throw std::runtime_error("instruction pointer escaped bytecode");
      auto ins=f.chunk->code[f.ip++];
      switch(ins.op){
        case CONST:push(f.chunk->constants.at(ins.arg));break;
        case LOAD_GLOBAL:{auto it=globals.find(ins.text);if(it==globals.end())throw std::runtime_error("undefined variable: "+ins.text);push(it->second);break;}
        case STORE_GLOBAL:globals[ins.text]=pop();break;
        case LOAD_LOCAL:if(ins.arg<0||(size_t)ins.arg>=f.locals.size())throw std::runtime_error("invalid local");push(f.locals[ins.arg]->value);break;
        case STORE_LOCAL:{auto v=pop();if(ins.arg<0)throw std::runtime_error("invalid local");if((size_t)ins.arg>=f.locals.size())f.locals.resize(ins.arg+1);if(!f.locals[ins.arg])f.locals[ins.arg]=std::make_shared<Cell>();f.locals[ins.arg]->value=v;break;}
        case MAKE_FUNCTION:case MAKE_CLOSURE:push(makeFunction(f,f.chunk->functions.at(ins.arg)));break;
        case CALL:{
          auto argc=ins.arg; if(argc<0||(size_t)argc>stack.size())throw std::runtime_error("stack underflow during call");
          std::vector<Value> args(stack.end()-argc,stack.end());stack.resize(stack.size()-argc);
          auto callee=pop();auto fn=std::get_if<std::shared_ptr<Function>>(&callee);
          if(!fn||!*fn)throw std::runtime_error("attempted to BONK a non-function");
          if(args.size()!=(*fn)->chunk->arity)throw std::runtime_error((*fn)->chunk->name+" expected "+std::to_string((*fn)->chunk->arity)+" argument(s), got "+std::to_string(args.size()));
          {std::vector<std::shared_ptr<Cell>> locals;for(auto& a:args)locals.push_back(std::make_shared<Cell>(Cell{std::move(a)}));frames.push_back({(*fn)->chunk,0,std::move(locals),(*fn)->freeCells});break;}
        }
        case RETURN:{auto v=pop();const size_t leaving=frames.size()-1;handlers.erase(std::remove_if(handlers.begin(),handlers.end(),[&](const Handler&h){return h.frameIndex>=leaving;}),handlers.end());frames.pop_back();if(frames.empty())return v;push(v);break;}
        case MAKE_ARRAY:{auto n=(size_t)ins.arg;if(n>stack.size())throw std::runtime_error("array stack underflow");auto a=std::make_shared<Array>();a->values.assign(stack.end()-n,stack.end());stack.resize(stack.size()-n);push(a);break;}
        case GET_INDEX:{auto idx=pop(),obj=pop();if(auto a=std::get_if<std::shared_ptr<Array>>(&obj)){auto i=number(idx);if(i<0||std::floor(i)!=i||static_cast<size_t>(i)>=(*a)->values.size())throw std::runtime_error("array index out of range");push((*a)->values[static_cast<size_t>(i)]);}else if(auto o=std::get_if<std::shared_ptr<Object>>(&obj)){if(!std::holds_alternative<std::string>(idx))throw std::runtime_error("object index must be a string");auto it=(*o)->values.find(std::get<std::string>(idx));push(it==(*o)->values.end()?Value{}:it->second);}else throw std::runtime_error("cannot index this value");break;}
        case SET_INDEX:{auto val=pop(),idx=pop(),obj=pop();if(auto a=std::get_if<std::shared_ptr<Array>>(&obj)){auto i=number(idx);if(i<0||std::floor(i)!=i||static_cast<size_t>(i)>=(*a)->values.size())throw std::runtime_error("array index out of range");(*a)->values[static_cast<size_t>(i)]=val;push(val);}else if(auto o=std::get_if<std::shared_ptr<Object>>(&obj)){if(!std::holds_alternative<std::string>(idx))throw std::runtime_error("object index must be a string");(*o)->values[std::get<std::string>(idx)]=val;push(val);}else throw std::runtime_error("cannot index this value");break;}
        case ADD:case SUB:case MUL:case DIV:case MOD:{auto b=pop(),a=pop();push(binary(ins.op,a,b));break;}
        case EQ:{auto b=pop(),a=pop();push(equal(a,b));break;} case NE:{auto b=pop(),a=pop();push(!equal(a,b));break;}
        case LT:{auto b=pop(),a=pop();push(number(a)<number(b));break;} case LTE:{auto b=pop(),a=pop();push(number(a)<=number(b));break;}
        case GT:{auto b=pop(),a=pop();push(number(a)>number(b));break;} case GTE:{auto b=pop(),a=pop();push(number(a)>=number(b));break;}
        case NOT:push(!truthy(pop()));break; case NEG:push(-number(pop()));break;
        case JUMP:f.ip=ins.arg;break; case JUMP_IF_FALSE:if(!truthy(pop()))f.ip=ins.arg;break; case JUMP_IF_TRUE:if(truthy(pop()))f.ip=ins.arg;break;
        case PRINT:std::cout<<display(pop())<<"\n";break; case POP:pop();break;
        case HALT:return pop();
        case MAKE_OBJECT:{auto n=static_cast<size_t>(ins.arg);if(stack.size()<n*2)throw std::runtime_error("object stack underflow");auto o=std::make_shared<Object>();auto start=stack.size()-n*2;for(size_t i=0;i<n;i++){auto key=stack[start+i*2],value=stack[start+i*2+1];if(!std::holds_alternative<std::string>(key))throw std::runtime_error("object key must be a string");o->values[std::get<std::string>(key)]=value;}stack.resize(start);push(o);break;}
        case GET_MEMBER:{auto key=pop(),obj=pop();if(!std::holds_alternative<std::string>(key))throw std::runtime_error("member name must be a string");if(auto o=std::get_if<std::shared_ptr<Object>>(&obj)){auto it=(*o)->values.find(std::get<std::string>(key));push(it==(*o)->values.end()?Value{}:it->second);}else throw std::runtime_error("member access requires an object");break;}
        case SET_MEMBER:{auto value=pop(),key=pop(),obj=pop();if(!std::holds_alternative<std::string>(key))throw std::runtime_error("member name must be a string");if(auto o=std::get_if<std::shared_ptr<Object>>(&obj)){(*o)->values[std::get<std::string>(key)]=value;push(value);}else throw std::runtime_error("member assignment requires an object");break;}
        case SETUP_CATCH:handlers.push_back({frames.size()-1,static_cast<size_t>(ins.arg),stack.size()});break;
        case POP_CATCH:if(handlers.empty())throw std::runtime_error("catch handler stack underflow");handlers.pop_back();break;
        case THROW:{auto error=pop();raise(std::move(error));break;}
        case LOAD_FREE:if(ins.arg<0||(size_t)ins.arg>=f.freeCells.size())throw std::runtime_error("invalid captured slot");push(f.freeCells[ins.arg]->value);break;
        case STORE_FREE:{auto v=pop();if(ins.arg<0||(size_t)ins.arg>=f.freeCells.size())throw std::runtime_error("invalid captured slot");f.freeCells[ins.arg]->value=v;break;}
        default:throw std::runtime_error("unknown opcode");
      }
    }
    return {};
  }
};

} // namespace glop


static bool gPlainDiagnostics=false;

static std::string chaosDiagnostic(const std::string& message){
  if(gPlainDiagnostics) return "GLOP ERROR: "+message;
  std::string code="GLOP-E9999",cat="[CHAOS ENGINE]",what="THE BYTECODE MACHINE HAS ENCOUNTERED PREMIUM NONSENSE.",
             why="The runtime hit a condition it cannot safely continue through.",
             fix="Inspect the failing operation and the source that produced this bytecode.";
  if(message.find("stack underflow")!=std::string::npos){code="GLOP-E6001";cat="[STACK GOBLIN]";what="THE STACK IS EMPTY. SOMETHING TRIED TO GRAB A VALUE FROM THE VOID.";why="The bytecode expected a value that was never pushed or was already consumed.";fix="Check compiler stack discipline and the instruction sequence around the failing operation.";}
  else if(message.find("undefined variable")!=std::string::npos){code="GLOP-E2001";cat="[NAME GOBLIN]";what="THE BYTECODE ASKED FOR A NAME THAT DOES NOT EXIST.";why="No global/local binding was available for the requested name.";fix="Declare the value, check scope, and rebuild the bytecode.";}
  else if(message.find("expected ")!=std::string::npos && message.find("argument")!=std::string::npos){code="GLOP-E2002";cat="[BONK MISFIRE]";what="THE WIZARD RECEIVED THE WRONG NUMBER OF OFFERINGS.";why="Call arguments do not match the function arity stored in bytecode.";fix="Pass exactly the declared number of arguments and rebuild.";}
  else if(message.find("division by zero")!=std::string::npos){code="GLOP-E3001";cat="[MATH GREMLIN]";what="ZERO HAS ENTERED THE DENOMINATOR.";why="The divisor evaluated to zero at runtime.";fix="Guard the divisor with SUS before division.";}
  else if(message.find("array index out of range")!=std::string::npos){code="GLOP-E3002";cat="[INDEX CANNON]";what="THE INDEX WAS FIRED PAST THE END OF THE ARRAY.";why="The requested position is outside the array.";fix="Check LEN(array) and use a valid zero-based index.";}
  return code+" "+cat+"\n\n  WHAT HAPPENED\n  "+what+"\n\n  WHY THIS MAY HAVE HAPPENED\n  "+why+"\n\n  WHAT CAN BE DONE\n  "+fix+"\n\n  TECHNICAL DETAIL\n  "+message+"\n\n  CHAOS REPORT\n  BYTECODE → STACK → PANIC → DIAGNOSE → SURVIVE";
}

int main(int argc,char**argv){
  try{
    std::vector<std::string> positional;
    for(int i=1;i<argc;++i){
      std::string arg=argv[i];
      if(arg=="--plain"){gPlainDiagnostics=true;continue;}
      if(arg=="--help"||arg=="-h"){
        std::cout<<"GLOP 0.9.0 bytecode runtime — CHAOS MODE ENABLED\n";
        std::cout<<"usage: glop-runtime [--plain] <program.gbc>\n";
        std::cout<<"diagnostics: chaotic by default; use --plain for machine-friendly output\n";
        return 0;
      }
      if(arg=="--version"||arg=="-v"){std::cout<<"GLOP 0.9.0 bytecode runtime\n";return 0;}
      positional.push_back(std::move(arg));
    }
    if(positional.size()!=1) throw std::runtime_error("usage: glop-runtime [--plain] <program.gbc>");
    auto chunk=glop::load(positional[0]); auto result=glop::VM(chunk).run(); (void)result; return 0;
  }catch(const std::exception&e){std::cerr<<chaosDiagnostic(e.what())<<"\n";return 1;}
}
