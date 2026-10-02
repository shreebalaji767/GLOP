#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <variant>
#include <vector>

namespace glop {

struct Error : std::runtime_error { using std::runtime_error::runtime_error; };
struct Value;
struct ReturnSignal;
struct BreakSignal {};
struct CatchSignal { std::string message; };
struct ContinueSignal {};

struct Token { enum Kind { ID, NUM, STR, OP, PUNC, END } kind; std::string text; double number=0; int line=1,col=1; };

class Lexer {
  std::string s; size_t p=0; int line=1,col=1;
  std::unordered_map<std::string,bool> kw{{"GLOP",1},{"YAP",1},{"SUS",1},{"NAH",1},{"SPIN",1},{"WIZARD",1},{"YEET",1},{"BASED",1},{"CAP",1},{"VOID",1},{"OOPSIE",1},{"TRY",1},{"CATCH",1},{"NOPE",1},{"ZOOM",1},{"BONK",1}};
  char peek(size_t n=0) const { return p+n<s.size()?s[p+n]:'\0'; }
  char take(){char c=peek();if(!c)return 0;p++;if(c=='\n'){line++;col=1;}else col++;return c;}
public:
  explicit Lexer(std::string x):s(std::move(x)){}
  std::vector<Token> all(){
    std::vector<Token> out;
    while(p<s.size()){
      char c=peek();
      if(std::isspace((unsigned char)c)){take();continue;}
      if(c=='/'&&peek(1)=='/'){while(peek()&&peek()!='\n')take();continue;}
      int l=line,cc=col;
      if(std::isalpha((unsigned char)c)||c=='_'){std::string x;while(std::isalnum((unsigned char)peek())||peek()=='_')x+=take();out.push_back({kw.count(x)?ID:ID,x,0,l,cc});continue;}
      if(std::isdigit((unsigned char)c)){std::string x;while(std::isdigit((unsigned char)peek()))x+=take();if(peek()=='.'){x+=take();while(std::isdigit((unsigned char)peek()))x+=take();}out.push_back({NUM,x,std::stod(x),l,cc});continue;}
      if(c=='"'||c=='\''||c=='«'){char q=take(),end=q=='«'?'»':q;std::string x;while(peek()&&peek()!=end){if(peek()=='\\'){take();x+=take();}else x+=take();}if(take()!=end)throw Error("unterminated string at "+std::to_string(l)+":"+std::to_string(cc));out.push_back({STR,x,0,l,cc});continue;}
      std::string two;two+=c;two+=peek(1);
      if(two=="=="||two=="!="||two=="<="||two==">="||two=="&&"||two=="||"||two=="+="||two=="-="||two=="*="||two=="/="){take();take();out.push_back({OP,two,0,l,cc});continue;}
      if(std::string("+-*/%<>=!").find(c)!=std::string::npos){take();out.push_back({OP,std::string(1,c),0,l,cc});continue;}
      if(std::string("(){}[],.:;").find(c)!=std::string::npos){take();out.push_back({PUNC,std::string(1,c),0,l,cc});continue;}
      throw Error("unexpected character at "+std::to_string(l)+":"+std::to_string(cc));
    }
    out.push_back({END,"",0,line,col}); return out;
  }
};

struct Expr;
struct Stmt;
struct Function;
struct Env;
struct Value {
  using Array=std::vector<Value>;
  using Object=std::unordered_map<std::string,Value>;
  std::variant<std::monostate,bool,double,std::string,std::shared_ptr<Array>,std::shared_ptr<Object>,std::shared_ptr<Function>,std::function<Value(const std::vector<Value>&)>> v;
  Value():v(std::monostate{}){} Value(bool x):v(x){} Value(double x):v(x){} Value(std::string x):v(std::move(x)){}
  Value(const char*x):v(std::string(x)){} Value(std::shared_ptr<Array>x):v(std::move(x)){} Value(std::shared_ptr<Object>x):v(std::move(x)){} Value(std::shared_ptr<Function>x):v(std::move(x)){} Value(std::function<Value(const std::vector<Value>&)>x):v(std::move(x)){}
};
struct ReturnSignal { Value value; };
struct Expr { virtual ~Expr()=default; virtual Value eval(std::shared_ptr<Env>)=0; };
struct Stmt { virtual ~Stmt()=default; virtual void exec(std::shared_ptr<Env>)=0; };

static bool truth(const Value&v){if(std::holds_alternative<std::monostate>(v.v))return false;if(auto p=std::get_if<bool>(&v.v))return *p;if(auto p=std::get_if<double>(&v.v))return *p!=0;if(auto p=std::get_if<std::string>(&v.v))return !p->empty();return true;}
static std::string show(const Value&v){
  if(std::holds_alternative<std::monostate>(v.v))return "VOID";
  if(auto p=std::get_if<bool>(&v.v))return *p?"BASED":"CAP";
  if(auto p=std::get_if<double>(&v.v)){if(std::floor(*p)==*p)return std::to_string((long long)*p);return std::to_string(*p);}
  if(auto p=std::get_if<std::string>(&v.v))return *p;
  if(auto p=std::get_if<std::shared_ptr<Value::Array>>(&v.v)){std::string s="[";for(size_t i=0;i<(*p)->size();i++){if(i)s+=", ";s+=show((*p)->at(i));}return s+"]";}
  if(auto p=std::get_if<std::shared_ptr<Value::Object>>(&v.v))return "[object]";
  if(std::holds_alternative<std::function<Value(const std::vector<Value>&)>>(v.v))return "[native-function]";
  return "[function]";
}
static double num(const Value&v){if(auto p=std::get_if<double>(&v.v))return *p;throw Error("expected number");}

struct Env : std::enable_shared_from_this<Env>{
  std::shared_ptr<Env> parent; std::unordered_map<std::string,Value> vars;
  explicit Env(std::shared_ptr<Env>p=nullptr):parent(std::move(p)){}
  bool hasLocal(const std::string&n)const{return vars.count(n);}
  bool has(const std::string&n)const{return vars.count(n)||(parent&&parent->has(n));}
  Value get(const std::string&n){if(vars.count(n))return vars[n];if(parent)return parent->get(n);throw Error("undefined variable: "+n);}
  void set(const std::string&n,Value v){if(vars.count(n)){vars[n]=std::move(v);return;}if(parent&&parent->has(n)){parent->set(n,std::move(v));return;}throw Error("undefined variable: "+n);}
};

struct Literal:Expr{Value v;explicit Literal(Value x):v(std::move(x)){}Value eval(std::shared_ptr<Env>)override{return v;}};
struct Name:Expr{std::string n;explicit Name(std::string x):n(std::move(x)){}Value eval(std::shared_ptr<Env>e)override{return e->get(n);}};
struct ArrayExpr:Expr{std::vector<std::unique_ptr<Expr>> a;Value eval(std::shared_ptr<Env>e)override{auto x=std::make_shared<Value::Array>();for(auto&z:a)x->push_back(z->eval(e));return x;}};
struct ObjectExpr:Expr{std::vector<std::pair<std::string,std::unique_ptr<Expr>>> p;Value eval(std::shared_ptr<Env>e)override{auto x=std::make_shared<Value::Object>();for(auto&z:p)(*x)[z.first]=z.second->eval(e);return x;}};
struct Unary:Expr{std::string op;std::unique_ptr<Expr>a;Value eval(std::shared_ptr<Env>e)override{auto x=a->eval(e);if(op=="!")return !truth(x);return -num(x);}};
struct Binary:Expr{std::string op;std::unique_ptr<Expr>a,b;Value eval(std::shared_ptr<Env>e)override{
  auto x=a->eval(e);if(op=="&&")return truth(x)?truth(b->eval(e)):false;if(op=="||")return truth(x)?true:truth(b->eval(e));auto y=b->eval(e);
  if(op=="+"){if(std::holds_alternative<std::string>(x.v)&&std::holds_alternative<std::string>(y.v))return std::get<std::string>(x.v)+std::get<std::string>(y.v);return num(x)+num(y);}
  if(op=="-")return num(x)-num(y);if(op=="*")return num(x)*num(y);if(op=="/"){auto d=num(y);if(d==0)throw Error("division by zero");return num(x)/d;}if(op=="%")return std::fmod(num(x),num(y));
  if(op=="==")return show(x)==show(y);if(op=="!=")return show(x)!=show(y);if(op=="<")return num(x)<num(y);if(op=="<=")return num(x)<=num(y);if(op==">")return num(x)>num(y);if(op==">=")return num(x)>=num(y);throw Error("unknown operator "+op);
}};
struct Member:Expr{std::unique_ptr<Expr>o;std::string k;Value eval(std::shared_ptr<Env>e)override{auto x=o->eval(e);auto p=std::get_if<std::shared_ptr<Value::Object>>(&x.v);if(!p)throw Error("member access requires object");return (*p)->count(k)?(*p)->at(k):Value();}};
struct Index:Expr{std::unique_ptr<Expr>o,i;Value eval(std::shared_ptr<Env>e)override{auto x=o->eval(e),q=i->eval(e);size_t n=(size_t)num(q);if(auto p=std::get_if<std::shared_ptr<Value::Array>>(&x.v)){if(n>=(*p)->size())throw Error("array index out of range");return (*p)->at(n);}throw Error("index requires array");}};

struct Function {std::vector<std::string>params;std::vector<std::unique_ptr<Stmt>> body;std::shared_ptr<Env>closure;Value call(const std::vector<Value>&args){
  if(args.size()!=params.size())throw Error("wrong argument count");auto e=std::make_shared<Env>(closure);for(size_t i=0;i<args.size();i++)e->vars[params[i]]=args[i];
  try{for(auto&s:body)s->exec(e);}catch(ReturnSignal&r){return r.value;}return Value();
}};
struct Call:Expr{std::unique_ptr<Expr>f;std::vector<std::unique_ptr<Expr>>args;Value eval(std::shared_ptr<Env>e)override{auto v=f->eval(e);auto p=std::get_if<std::shared_ptr<Function>>(&v.v);auto nf=std::get_if<std::function<Value(const std::vector<Value>&)>>(&v.v);
    std::vector<Value>a;for(auto&x:args)a.push_back(x->eval(e));
    if(nf)return (*nf)(a);
    if(p)return (*p)->call(a);
    throw Error("BONK target is not a function");}};

struct Var:Stmt{std::string n;std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{e->vars[n]=v->eval(e);}};
struct Print:Stmt{std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{std::cout<<show(v->eval(e))<<"\n";}};
struct ExprStmt:Stmt{std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{v->eval(e);}};
struct Return:Stmt{std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{throw ReturnSignal{v->eval(e)};}};
struct Throw:Stmt{std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{throw Error(show(v->eval(e)));}};

static Value applyAssign(const std::string&op,const Value&old,const Value&rhs){
  if(op=="=")return rhs;
  if(op=="+="){if(std::holds_alternative<std::string>(old.v)||std::holds_alternative<std::string>(rhs.v))return show(old)+show(rhs);return num(old)+num(rhs);}
  if(op=="-=")return num(old)-num(rhs);
  if(op=="*=")return num(old)*num(rhs);
  if(op=="/="){auto d=num(rhs);if(d==0)throw Error("division by zero");return num(old)/d;}
  throw Error("unknown assignment operator "+op);
}
struct Assign:Stmt{std::string n,op;std::unique_ptr<Expr>v;void exec(std::shared_ptr<Env>e)override{e->set(n,applyAssign(op,e->get(n),v->eval(e)));}};
struct Block:Stmt{std::vector<std::unique_ptr<Stmt>>s;void exec(std::shared_ptr<Env>e)override{auto x=std::make_shared<Env>(e);for(auto&z:s)z->exec(x);}};
struct TryCatch:Stmt{
  std::unique_ptr<Block>body,handler; std::string name;
  void exec(std::shared_ptr<Env>e)override{
    try{body->exec(e);}
    catch(const ReturnSignal&){throw;}
    catch(const BreakSignal&){throw;}
    catch(const ContinueSignal&){throw;}
    catch(const Error&x){auto h=std::make_shared<Env>(e);h->vars[name]=Value(std::string(x.what()));handler->exec(h);}
  }
};
struct If:Stmt{std::unique_ptr<Expr>t;std::unique_ptr<Block>a,b;void exec(std::shared_ptr<Env>e)override{if(truth(t->eval(e)))a->exec(e);else if(b)b->exec(e);}};
struct While:Stmt{std::unique_ptr<Expr>t;std::unique_ptr<Block>b;void exec(std::shared_ptr<Env>e)override{while(truth(t->eval(e))){try{b->exec(e);}catch(BreakSignal&){break;}catch(ContinueSignal&){}}}};
struct Break:Stmt{void exec(std::shared_ptr<Env>)override{throw BreakSignal{};}};
struct Continue:Stmt{void exec(std::shared_ptr<Env>)override{throw ContinueSignal{};}};
struct TargetAssign:Stmt{
  std::unique_ptr<Expr>target; std::string op; std::unique_ptr<Expr>value;
  void exec(std::shared_ptr<Env>e)override{
    auto rhs=value->eval(e);
    if(auto n=dynamic_cast<Name*>(target.get())){e->set(n->n,applyAssign(op,e->get(n->n),rhs));return;}
    if(auto m=dynamic_cast<Member*>(target.get())){
      auto obj=m->o->eval(e);auto p=std::get_if<std::shared_ptr<Value::Object>>(&obj.v);
      if(!p)throw Error("member assignment requires object");
      Value old=(*p)->count(m->k)?(*p)->at(m->k):Value();(*p)[m->k]=applyAssign(op,old,rhs);return;
    }
    if(auto q=dynamic_cast<Index*>(target.get())){
      auto obj=q->o->eval(e),idx=q->i->eval(e);auto p=std::get_if<std::shared_ptr<Value::Array>>(&obj.v);
      if(!p)throw Error("index assignment requires array");
      double d=num(idx);if(d<0||std::floor(d)!=d)throw Error("array index must be an integer");
      size_t n=(size_t)d;if(n>=(*p)->size())throw Error("array index out of range");
      (*p)->at(n)=applyAssign(op,(*p)->at(n),rhs);return;
    }
    throw Error("invalid assignment target");
  }
};
struct FnDecl:Stmt{std::string n;std::vector<std::string>p;std::vector<std::unique_ptr<Stmt>>b;void exec(std::shared_ptr<Env>e)override{auto f=std::make_shared<Function>();f->params=p;f->body=std::move(b);f->closure=e;e->vars[n]=f;}};

class Parser {
 std::vector<Token>t;size_t i=0;
 Token&cur(){return t[i];}bool at(const std::string&s){return cur().text==s;}Token take(){return t[i++];}
 void need(const std::string&s){if(!at(s))throw Error("expected "+s+" at "+std::to_string(cur().line)+":"+std::to_string(cur().col));take();}
 std::unique_ptr<Block> block(){need("{");auto b=std::make_unique<Block>();while(!at("}")&&cur().kind!=Token::END)b->s.push_back(stmt());need("}");return b;}
public:
 explicit Parser(std::vector<Token>x):t(std::move(x)){}
 std::vector<std::unique_ptr<Stmt>> program(){std::vector<std::unique_ptr<Stmt>>x;while(cur().kind!=Token::END)x.push_back(stmt());return x;}
 std::unique_ptr<Stmt> stmt(){
  if(at("GLOP")){take();auto n=take().text;need("=");auto v=expr();if(at(";"))take();return std::make_unique<Var>(Var{n,std::move(v)});}
  if(at("YAP")){take();auto v=expr();if(at(";"))take();return std::make_unique<Print>(Print{std::move(v)});}
  if(at("YEET")){take();auto v=at("}")?std::make_unique<Literal>(Value()):expr();if(at(";"))take();return std::make_unique<Return>(Return{std::move(v)});}
  if(at("OOPSIE")){take();auto v=expr();if(at(";"))take();return std::make_unique<Throw>(Throw{std::move(v)});}
  if(at("NOPE")){take();if(at(";"))take();return std::make_unique<Break>();}
  if(at("ZOOM")){take();if(at(";"))take();return std::make_unique<Continue>();}
  if(at("TRY")){take();auto b=block();if(!at("CATCH"))throw Error("TRY requires CATCH");take();auto n=take().text;auto h=block();return std::make_unique<TryCatch>(TryCatch{std::move(b),std::move(h),n});}
  if(at("GLOP"))throw Error("unreachable");
  if(at("WIZARD")){take();auto n=take().text;need("(");std::vector<std::string>p;if(!at(")")){do{p.push_back(take().text);}while(at(",")&&take().text==",");}need(")");auto b=block();return std::make_unique<FnDecl>(FnDecl{n,std::move(p),std::move(b->s)});}
  if(at("SUS")){take();auto t=expr();auto a=block();std::unique_ptr<Block>b;if(at("NAH")){take();b=block();}return std::make_unique<If>(If{std::move(t),std::move(a),std::move(b)});}
  if(at("SPIN")){take();auto t=expr();auto b=block();return std::make_unique<While>(While{std::move(t),std::move(b)});}
  auto v=expr();if(cur().kind==Token::OP&&std::string("= += -= *= /=").find(cur().text)!=std::string::npos){auto op=take().text;auto x=expr();if(at(";"))take();return std::make_unique<TargetAssign>(TargetAssign{std::move(v),op,std::move(x)});}if(at(";"))take();return std::make_unique<ExprStmt>(ExprStmt{std::move(v)});
 }
 std::unique_ptr<Expr> expr(){return binary(0);}
 std::unique_ptr<Expr> binary(int min){auto a=unary();static const std::unordered_map<std::string,int>p{{"||",1},{"&&",2},{"==",3},{"!=",3},{"<",4},{"<=",4},{">",4},{">=",4},{"+",5},{"-",5},{"*",6},{"/",6},{"%",6}};while(p.count(cur().text)&&p.at(cur().text)>=min){auto op=take().text;auto b=binary(p.at(op)+1);a=std::make_unique<Binary>(Binary{op,std::move(a),std::move(b)});}return a;}
 std::unique_ptr<Expr> unary(){if(at("!")){take();return std::make_unique<Unary>(Unary{"!",unary()});}if(at("-")){take();return std::make_unique<Unary>(Unary{"-",unary()});}return postfix(primary());}
 std::unique_ptr<Expr> postfix(std::unique_ptr<Expr>a){while(true){if(at("(")){take();auto c=std::make_unique<Call>();c->f=std::move(a);if(!at(")")){do{c->args.push_back(expr());}while(at(",")&&take().text==",");}need(")");a=std::move(c);continue;}if(at("[")){take();auto x=expr();need("]");auto q=std::make_unique<Index>();q->o=std::move(a);q->i=std::move(x);a=std::move(q);continue;}if(at(".")){take();auto q=std::make_unique<Member>();q->o=std::move(a);q->k=take().text;a=std::move(q);continue;}break;}return a;}
 std::unique_ptr<Expr> primary(){
  auto x=take();
  if(x.kind==Token::NUM)return std::make_unique<Literal>(x.number);
  if(x.kind==Token::STR)return std::make_unique<Literal>(x.text);
  if(x.text=="BASED")return std::make_unique<Literal>(true);if(x.text=="CAP")return std::make_unique<Literal>(false);if(x.text=="VOID")return std::make_unique<Literal>(Value());
  if(x.text=="BONK"){auto f=std::make_unique<Name>(take().text);need("(");auto c=std::make_unique<Call>();c->f=std::move(f);if(!at(")")){do{c->args.push_back(expr());}while(at(",")&&take().text==",");}need(")");return c;}
  if(x.kind==Token::ID)return std::make_unique<Name>(x.text);
  if(x.text=="("){auto a=expr();need(")");return a;}
  if(x.text=="["){auto a=std::make_unique<ArrayExpr>();if(!at("]")){do{a->a.push_back(expr());}while(at(",")&&take().text==",");}need("]");return a;}
  if(x.text=="{"){auto a=std::make_unique<ObjectExpr>();if(!at("}")){do{auto k=take().text;need(":");a->p.push_back({k,expr()});}while(at(",")&&take().text==",");}need("}");return a;}
  throw Error("expected expression at "+std::to_string(x.line)+":"+std::to_string(x.col));
 }
};

static Value nativeLen(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("LEN expects 1 argument");
  const auto& v=a[0];
  if(auto p=std::get_if<std::string>(&v.v)) return (double)p->size();
  if(auto p=std::get_if<std::shared_ptr<Value::Array>>(&v.v)) return (double)(*p)->size();
  if(auto p=std::get_if<std::shared_ptr<Value::Object>>(&v.v)) return (double)(*p)->size();
  throw Error("LEN expects string, array, or object");
}
static Value nativePush(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("PUSH expects 2 arguments");
  auto p=std::get_if<std::shared_ptr<Value::Array>>(&a[0].v);
  if(!p) throw Error("PUSH expects an array");
  (*p)->push_back(a[1]); return (double)(*p)->size();
}
static Value nativePop(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("POP expects 1 argument");
  auto p=std::get_if<std::shared_ptr<Value::Array>>(&a[0].v);
  if(!p) throw Error("POP expects an array");
  if((*p)->empty()) throw Error("POP from empty array");
  Value x=(*p)->back(); (*p)->pop_back(); return x;
}
static Value nativeType(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("TYPE expects 1 argument");
  const auto& v=a[0];
  if(std::holds_alternative<std::monostate>(v.v)) return "void";
  if(std::holds_alternative<bool>(v.v)) return "bool";
  if(std::holds_alternative<double>(v.v)) return "number";
  if(std::holds_alternative<std::string>(v.v)) return "string";
  if(std::holds_alternative<std::shared_ptr<Value::Array>>(v.v)) return "array";
  if(std::holds_alternative<std::shared_ptr<Value::Object>>(v.v)) return "object";
  return std::holds_alternative<std::function<Value(const std::vector<Value>&)>>(v.v) ? "native-function" : "function";
}
static Value nativeAbs(const std::vector<Value>& a){ if(a.size()!=1) throw Error("ABS expects 1 argument"); return std::fabs(num(a[0])); }
static Value nativeSqrt(const std::vector<Value>& a){ if(a.size()!=1) throw Error("SQRT expects 1 argument"); double x=num(a[0]); if(x<0) throw Error("SQRT expects a non-negative number"); return std::sqrt(x); }
static Value nativeFloor(const std::vector<Value>& a){ if(a.size()!=1) throw Error("FLOOR expects 1 argument"); return std::floor(num(a[0])); }
static Value nativeCeil(const std::vector<Value>& a){ if(a.size()!=1) throw Error("CEIL expects 1 argument"); return std::ceil(num(a[0])); }
static Value nativeToString(const std::vector<Value>& a){ if(a.size()!=1) throw Error("TO_STRING expects 1 argument"); return show(a[0]); }

static std::string readFile(const std::string&f){std::ifstream in(f);if(!in)throw Error("cannot open "+f);return std::string((std::istreambuf_iterator<char>(in)),{});}
}

int main(int argc,char**argv){
  try{
    if(argc!=2){std::cerr<<"GLOP 0.4.0 native runtime\nusage: glop <program.glop>\n";return 2;}
    auto ast=glop::Parser(glop::Lexer(glop::readFile(argv[1])).all()).program();
    auto env=std::make_shared<glop::Env>();
    for(auto&s:ast)s->exec(env);
    return 0;
  }catch(const glop::Error&e){std::cerr<<"GLOP OOPSIE: "<<e.what()<<"\n";return 1;}
   catch(const glop::ReturnSignal&){std::cerr<<"GLOP OOPSIE: YEET outside WIZARD\n";return 1;}
   catch(...){std::cerr<<"GLOP OOPSIE: unknown runtime failure\n";return 1;}
}
