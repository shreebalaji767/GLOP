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
struct Chunk { uint32_t arity{}; std::string name; std::vector<Value> constants; std::vector<std::shared_ptr<Chunk>> functions; std::vector<Instruction> code; };
struct Function { std::shared_ptr<Chunk> chunk; };
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
  auto c=std::make_shared<Chunk>(); c->arity=readU32(in); c->name=readString(in);
  auto nc=readU32(in); for(uint32_t i=0;i<nc;i++)c->constants.push_back(readValue(in));
  auto nf=readU32(in); for(uint32_t i=0;i<nf;i++)c->functions.push_back(readChunk(in));
  auto ni=readU32(in); for(uint32_t i=0;i<ni;i++)c->code.push_back(readInstruction(in));
  return c;
}

static std::shared_ptr<Chunk> load(const std::string& file){
  std::ifstream in(file,std::ios::binary); if(!in)throw std::runtime_error("cannot open "+file);
  char magic[4];in.read(magic,4);if(std::memcmp(magic,"GBC1",4)!=0)throw std::runtime_error("not a GLOP bytecode file");
  if(readU8(in)!=1)throw std::runtime_error("unsupported GBC version");
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
  if(auto p=std::get_if<std::shared_ptr<Object>>(&v))return "[object]";
  return "[function]";
}

enum : uint8_t {
 CONST,LOAD_GLOBAL,STORE_GLOBAL,LOAD_LOCAL,STORE_LOCAL,LOAD_FREE,STORE_FREE,
 MAKE_FUNCTION,MAKE_CLOSURE,CALL,RETURN,MAKE_ARRAY,MAKE_OBJECT,GET_INDEX,SET_INDEX,
 GET_MEMBER,SET_MEMBER,SETUP_CATCH,POP_CATCH,THROW,ADD,SUB,MUL,DIV,MOD,EQ,NE,LT,LTE,GT,GTE,
 NOT,NEG,JUMP,JUMP_IF_FALSE,JUMP_IF_TRUE,PRINT,POP,HALT
};

struct Frame { std::shared_ptr<Chunk> chunk; size_t ip{}; std::vector<Value> locals; };

class VM {
  std::shared_ptr<Chunk> root;
  std::vector<Value> stack;
  std::vector<Frame> frames;
  std::unordered_map<std::string,Value> globals;

  Value pop(){if(stack.empty())throw std::runtime_error("GLOP stack underflow");auto v=stack.back();stack.pop_back();return v;}
  void push(Value v){stack.push_back(std::move(v));}
  double number(const Value& v){if(auto p=std::get_if<double>(&v))return *p;throw std::runtime_error("expected number");}
  bool equal(const Value&a,const Value&b){return display(a)==display(b);}
  Value binary(uint8_t op,Value a,Value b){
    if(op==ADD && std::holds_alternative<std::string>(a) && std::holds_alternative<std::string>(b))return std::get<std::string>(a)+std::get<std::string>(b);
    double x=number(a),y=number(b);
    switch(op){case ADD:return x+y;case SUB:return x-y;case MUL:return x*y;case DIV:return x/y;case MOD:return std::fmod(x,y);}
    throw std::runtime_error("bad arithmetic opcode");
  }

public:
  explicit VM(std::shared_ptr<Chunk> c):root(std::move(c)){}
  Value run(){
    frames.push_back({root,0,{}});
    while(!frames.empty()){
      auto &f=frames.back();
      if(f.ip>=f.chunk->code.size())throw std::runtime_error("instruction pointer escaped bytecode");
      auto ins=f.chunk->code[f.ip++];
      switch(ins.op){
        case CONST:push(f.chunk->constants.at(ins.arg));break;
        case LOAD_GLOBAL:{auto it=globals.find(ins.text);if(it==globals.end())throw std::runtime_error("undefined variable: "+ins.text);push(it->second);break;}
        case STORE_GLOBAL:globals[ins.text]=pop();break;
        case LOAD_LOCAL:if(ins.arg<0||(size_t)ins.arg>=f.locals.size())throw std::runtime_error("invalid local");push(f.locals[ins.arg]);break;
        case STORE_LOCAL:{auto v=pop();if(ins.arg<0)throw std::runtime_error("invalid local");if((size_t)ins.arg>=f.locals.size())f.locals.resize(ins.arg+1);f.locals[ins.arg]=v;break;}
        case MAKE_FUNCTION:case MAKE_CLOSURE:push(std::make_shared<Function>(Function{f.chunk->functions.at(ins.arg)}));break;
        case CALL:{
          auto argc=ins.arg; if(argc<0||(size_t)argc>stack.size())throw std::runtime_error("stack underflow during call");
          std::vector<Value> args(stack.end()-argc,stack.end());stack.resize(stack.size()-argc);
          auto callee=pop();auto fn=std::get_if<std::shared_ptr<Function>>(&callee);
          if(!fn||!*fn)throw std::runtime_error("attempted to BONK a non-function");
          if(args.size()!=(*fn)->chunk->arity)throw std::runtime_error((*fn)->chunk->name+" expected "+std::to_string((*fn)->chunk->arity)+" argument(s), got "+std::to_string(args.size()));
          frames.push_back({(*fn)->chunk,0,std::move(args)});break;
        }
        case RETURN:{auto v=pop();frames.pop_back();if(frames.empty())return v;push(v);break;}
        case MAKE_ARRAY:{auto n=(size_t)ins.arg;if(n>stack.size())throw std::runtime_error("array stack underflow");auto a=std::make_shared<Array>();a->values.assign(stack.end()-n,stack.end());stack.resize(stack.size()-n);push(a);break;}
        case GET_INDEX:{auto idx=pop();auto obj=pop();auto i=(size_t)number(idx);if(auto a=std::get_if<std::shared_ptr<Array>>(&obj)){if(i>=(*a)->values.size())throw std::runtime_error("array index out of range");push((*a)->values[i]);}else throw std::runtime_error("GET_INDEX supports arrays in native runtime");break;}
        case SET_INDEX:{auto val=pop();auto idx=pop();auto obj=pop();auto i=(size_t)number(idx);auto a=std::get_if<std::shared_ptr<Array>>(&obj);if(!a||i>=(*a)->values.size())throw std::runtime_error("array index out of range");(*a)->values[i]=val;push(val);break;}
        case ADD:case SUB:case MUL:case DIV:case MOD:{auto b=pop(),a=pop();push(binary(ins.op,a,b));break;}
        case EQ:{auto b=pop(),a=pop();push(equal(a,b));break;} case NE:{auto b=pop(),a=pop();push(!equal(a,b));break;}
        case LT:{auto b=pop(),a=pop();push(number(a)<number(b));break;} case LTE:{auto b=pop(),a=pop();push(number(a)<=number(b));break;}
        case GT:{auto b=pop(),a=pop();push(number(a)>number(b));break;} case GTE:{auto b=pop(),a=pop();push(number(a)>=number(b));break;}
        case NOT:push(!truthy(pop()));break; case NEG:push(-number(pop()));break;
        case JUMP:f.ip=ins.arg;break; case JUMP_IF_FALSE:if(!truthy(pop()))f.ip=ins.arg;break; case JUMP_IF_TRUE:if(truthy(pop()))f.ip=ins.arg;break;
        case PRINT:std::cout<<display(pop())<<"\n";break; case POP:pop();break;
        case HALT:return pop();
        case MAKE_OBJECT:throw std::runtime_error("objects are not yet enabled in native runtime");
        case GET_MEMBER:case SET_MEMBER:case SETUP_CATCH:case POP_CATCH:case THROW:case LOAD_FREE:case STORE_FREE:
          throw std::runtime_error("opcode not yet enabled in native runtime: "+std::to_string(ins.op));
        default:throw std::runtime_error("unknown opcode");
      }
    }
    return {};
  }
};

} // namespace glop


static std::string chaosDiagnostic(const std::string& message){
  if(message.find("unterminated string")!=std::string::npos)
    return "GLOP-E1001 [SYNTAX GOBLIN] \n  THE QUOTE ESCAPED. THE STRING DID NOT.\n  Technical: "+message;
  if(message.find("unexpected character")!=std::string::npos)
    return "GLOP-E1002 [CHARACTER MUTINY] \n  A CHARACTER JUST WALKED INTO THE COMPILER UNINVITED.\n  Technical: "+message;
  if(message.find("expected ")==0)
    return "GLOP-E1003 [PARSER PANIC] \n  THE PARSER WANTED ONE THING AND GOT ABSOLUTELY ANOTHER.\n  Technical: "+message;
  if(message.find("undefined variable")!=std::string::npos)
    return "GLOP-E2001 [NAME GOBLIN] \n  THAT NAME DOES NOT EXIST IN THIS UNIVERSE.\n  Technical: "+message;
  if(message.find("wrong argument count")!=std::string::npos)
    return "GLOP-E2002 [BONK MISFIRE] \n  FUNCTION BONKED. ARGUMENTS DID NOT MATCH.\n  Technical: "+message;
  if(message.find("division by zero")!=std::string::npos)
    return "GLOP-E3001 [MATH GREMLIN] \n  ZERO HAS ENTERED THE DENOMINATOR. MATHEMATICS HAS FILED A COMPLAINT.\n  Technical: "+message;
  if(message.find("array index out of range")!=std::string::npos)
    return "GLOP-E3002 [INDEX CANNON] \n  YOU FIRED AN INDEX INTO EMPTY SPACE.\n  Technical: "+message;
  if(message.find("not a class")!=std::string::npos || message.find("unknown instance member")!=std::string::npos)
    return "GLOP-E4001 [OOPS CLASS DISASTER] \n  THE OBJECT-ORIENTED UNIVERSE HAS REJECTED YOUR REQUEST.\n  Technical: "+message;
  if(message.find("not a function")!=std::string::npos)
    return "GLOP-E4002 [BONK TARGET DISASTER] \n  YOU BONKED SOMETHING THAT IS NOT A FUNCTION.\n  IT REMAINS EXTREMELY UNIMPRESSED.\n  Technical: "+message;
  return "GLOP-E9999 [CHAOS ENGINE] \n  SOMETHING WENT SIDEWAYS WITH GREAT CONFIDENCE.\n  Technical: "+message;
}
static void printChaosSuccess(const std::string&what){
  std::cout<<"[SUCCESS: SOMEHOW] "<<what<<" \n";
}

int main(int argc,char**argv){
  try{
    if(argc!=2){std::cerr<<"usage: glop-runtime <program.gbc>\n";return 2;}
    auto chunk=glop::load(argv[1]); auto result=glop::VM(chunk).run(); (void)result; return 0;
  }catch(const std::exception&e){std::cerr<<chaosDiagnostic(e.what())<<"\n";return 1;}
}
