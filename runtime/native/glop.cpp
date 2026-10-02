#include <algorithm>
#include <cctype>
#include <cmath>
#include <chrono>
#include <cstdlib>
#include <thread>
#include <filesystem>
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
  std::unordered_map<std::string,bool> kw{{"GLOP",1},{"YAP",1},{"SUS",1},{"NAH",1},{"SPIN",1},{"WIZARD",1},{"YEET",1},{"BASED",1},{"CAP",1},{"VOID",1},{"OOPSIE",1},{"TRY",1},{"CATCH",1},{"NOPE",1},{"ZOOM",1},{"BONK",1},{"OOPS",1},{"NEW",1},{"THIS",1},{"SUPER",1},{"EXTENDS",1}};
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
      if(c=='/'&&peek(1)=='*'){take();take();while(peek()&&!(peek()=='*'&&peek(1)=='/'))take();if(!peek())throw Error("unterminated block comment");take();take();continue;}
      int l=line,cc=col;
      if(std::isalpha((unsigned char)c)||c=='_'){std::string x;while(std::isalnum((unsigned char)peek())||peek()=='_')x+=take();out.push_back({Token::ID,x,0,l,cc});continue;}
      if(std::isdigit((unsigned char)c)){std::string x;while(std::isdigit((unsigned char)peek()))x+=take();if(peek()=='.'){x+=take();while(std::isdigit((unsigned char)peek()))x+=take();}out.push_back({Token::NUM,x,std::stod(x),l,cc});continue;}
      if(c=='"'||c=='\\''){char q=take();std::string x;while(peek()&&peek()!=q){if(peek()=='\\\\'){take();x+=take();}else x+=take();}if(take()!=q)throw Error("unterminated string at "+std::to_string(l)+":"+std::to_string(cc));out.push_back({Token::STR,x,0,l,cc});continue;}
      if(c=='«'){take();std::string x;while(peek()&&peek()!='»')x+=take();if(take()!='»')throw Error("unterminated string at "+std::to_string(l)+":"+std::to_string(cc));out.push_back({Token::STR,x,0,l,cc});continue;}
      std::string two;two+=c;two+=peek(1);
      if(two=="=="||two=="!="||two=="<="||two==">="||two=="&&"||two=="||"||two=="+="||two=="-="||two=="*="||two=="/="){take();take();out.push_back({Token::OP,two,0,l,cc});continue;}
      if(std::string("+-*/%<>=!").find(c)!=std::string::npos){take();out.push_back({Token::OP,std::string(1,c),0,l,cc});continue;}
      if(std::string("(){}[],.:;").find(c)!=std::string::npos){take();out.push_back({Token::PUNC,std::string(1,c),0,l,cc});continue;}
      throw Error("unexpected character at "+std::to_string(l)+":"+std::to_string(cc));
    }
    out.push_back({Token::END,"",0,line,col}); return out;
  }
};

struct Expr;
struct Stmt;
struct Function;
struct Class;
struct Instance;
struct Env;
struct Value {
  using Array=std::vector<Value>;
  using Object=std::unordered_map<std::string,Value>;
  std::variant<std::monostate,bool,double,std::string,std::shared_ptr<Array>,std::shared_ptr<Object>,std::shared_ptr<Function>,std::shared_ptr<Class>,std::shared_ptr<Instance>,std::function<Value(const std::vector<Value>&)>> v;
  Value():v(std::monostate{}){} Value(bool x):v(x){} Value(double x):v(x){} Value(std::string x):v(std::move(x)){}
  Value(const char*x):v(std::string(x)){} Value(std::shared_ptr<Array>x):v(std::move(x)){} Value(std::shared_ptr<Object>x):v(std::move(x)){} Value(std::shared_ptr<Function>x):v(std::move(x)){} Value(std::shared_ptr<Class>x):v(std::move(x)){} Value(std::shared_ptr<Instance>x):v(std::move(x)){} Value(std::function<Value(const std::vector<Value>&)>x):v(std::move(x)){}
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
  if(std::holds_alternative<std::shared_ptr<Class>>(v.v))return "[class]";
  if(std::holds_alternative<std::shared_ptr<Instance>>(v.v))return "[instance]";
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

struct Class {
  std::string name;
  std::unordered_map<std::string,std::shared_ptr<Function>> methods;
  std::shared_ptr<Class> parent;
  std::shared_ptr<Env> closure;
  std::shared_ptr<Function> findMethod(const std::string& n) const {
    auto it=methods.find(n); if(it!=methods.end()) return it->second;
    return parent ? parent->findMethod(n) : nullptr;
  }
};
struct Instance { std::shared_ptr<Class> klass; std::unordered_map<std::string,Value> fields; };

struct Literal:Expr{Value v;explicit Literal(Value x):v(std::move(x)){}Value eval(std::shared_ptr<Env>)override{return v;}};
struct Name:Expr{std::string n;explicit Name(std::string x):n(std::move(x)){}Value eval(std::shared_ptr<Env>e)override{return e->get(n);}};
struct ArrayExpr:Expr{std::vector<std::unique_ptr<Expr>> a;Value eval(std::shared_ptr<Env>e)override{auto x=std::make_shared<Value::Array>();for(auto&z:a)x->push_back(z->eval(e));return x;}};
struct ObjectExpr:Expr{std::vector<std::pair<std::string,std::unique_ptr<Expr>>> p;Value eval(std::shared_ptr<Env>e)override{auto x=std::make_shared<Value::Object>();for(auto&z:p)(*x)[z.first]=z.second->eval(e);return x;}};
struct Unary:Expr{std::string op;std::unique_ptr<Expr>a; Unary(std::string o,std::unique_ptr<Expr>x):op(std::move(o)),a(std::move(x)){}Value eval(std::shared_ptr<Env>e)override{auto x=a->eval(e);if(op=="!")return !truth(x);return -num(x);}};
struct Binary:Expr{std::string op;std::unique_ptr<Expr>a,b; Binary(std::string o,std::unique_ptr<Expr>x,std::unique_ptr<Expr>y):op(std::move(o)),a(std::move(x)),b(std::move(y)){}Value eval(std::shared_ptr<Env>e)override{
  auto x=a->eval(e);if(op=="&&")return truth(x)?truth(b->eval(e)):false;if(op=="||")return truth(x)?true:truth(b->eval(e));auto y=b->eval(e);
  if(op=="+"){if(std::holds_alternative<std::string>(x.v)&&std::holds_alternative<std::string>(y.v))return std::get<std::string>(x.v)+std::get<std::string>(y.v);return num(x)+num(y);}
  if(op=="-")return num(x)-num(y);if(op=="*")return num(x)*num(y);if(op=="/"){auto d=num(y);if(d==0)throw Error("division by zero");return num(x)/d;}if(op=="%")return std::fmod(num(x),num(y));
  if(op=="==")return show(x)==show(y);if(op=="!=")return show(x)!=show(y);if(op=="<")return num(x)<num(y);if(op=="<=")return num(x)<=num(y);if(op==">")return num(x)>num(y);if(op==">=")return num(x)>=num(y);throw Error("unknown operator "+op);
}};
struct Member:Expr{std::unique_ptr<Expr>o;std::string k;Value eval(std::shared_ptr<Env>e)override;};
struct SuperMember:Expr{std::string k;explicit SuperMember(std::string x):k(std::move(x)){}Value eval(std::shared_ptr<Env>e)override{
  auto tv=e->get("THIS"); auto ip=std::get_if<std::shared_ptr<Instance>>(&tv.v); if(!ip||!*ip) throw Error("SUPER used outside an instance method");
  auto self=*ip; auto it=e->vars.find("__SUPER_OWNER"); if(it==e->vars.end()) throw Error("SUPER has no owning class");
  auto cp=std::get_if<std::shared_ptr<Class>>(&it->second.v); if(!cp||!*cp||!(*cp)->parent) throw Error("SUPER has no parent class");
  auto method=(*cp)->parent->findMethod(k); if(!method) throw Error("SUPER method not found: "+k);
  return std::function<Value(const std::vector<Value>&)>([method,self](const std::vector<Value>&args){return method->call(args,Value(self));});
}};
struct Index:Expr{std::unique_ptr<Expr>o,i;Value eval(std::shared_ptr<Env>e)override{auto x=o->eval(e),q=i->eval(e);size_t n=(size_t)num(q);if(auto p=std::get_if<std::shared_ptr<Value::Array>>(&x.v)){double d=num(q);if(d<0||std::floor(d)!=d)throw Error("array index must be an integer");if(n>=(*p)->size())throw Error("array index out of range");return (*p)->at(n);}throw Error("index requires array");}};

struct Function {std::weak_ptr<Class> ownerClass; std::vector<std::string>params;std::vector<std::unique_ptr<Stmt>> body;std::shared_ptr<Env>closure;Value call(const std::vector<Value>&args, Value thisValue=Value()){
  if(args.size()!=params.size())throw Error("wrong argument count");auto e=std::make_shared<Env>(closure);if(!std::holds_alternative<std::monostate>(thisValue.v)){e->vars["THIS"]=thisValue; if(auto owner=ownerClass.lock()) e->vars["__SUPER_OWNER"]=Value(owner);}for(size_t i=0;i<args.size();i++)e->vars[params[i]]=args[i];
  try{for(auto&s:body)s->exec(e);}catch(ReturnSignal&r){return r.value;}return Value();
}};
Value Member::eval(std::shared_ptr<Env>e){auto x=o->eval(e);if(auto ip=std::get_if<std::shared_ptr<Instance>>(&x.v)){auto inst=*ip;if(inst->fields.count(k))return inst->fields.at(k);auto method=inst->klass->findMethod(k);if(method){return std::function<Value(const std::vector<Value>&)>([method,inst](const std::vector<Value>&args){return method->call(args,Value(inst));});}throw Error("unknown instance member: "+k);}auto p=std::get_if<std::shared_ptr<Value::Object>>(&x.v);if(!p)throw Error("member access requires object or instance");return (*p)->count(k)?(*p)->at(k):Value();}

struct Call:Expr{std::unique_ptr<Expr>f;std::vector<std::unique_ptr<Expr>>args;Value eval(std::shared_ptr<Env>e)override{auto v=f->eval(e);auto p=std::get_if<std::shared_ptr<Function>>(&v.v);auto nf=std::get_if<std::function<Value(const std::vector<Value>&)>>(&v.v);
    std::vector<Value>a;for(auto&x:args)a.push_back(x->eval(e));
    if(nf)return (*nf)(a);
    if(p)return (*p)->call(a);
    throw Error("BONK target is not a function");}};

struct Var:Stmt{std::string n;std::unique_ptr<Expr>v; Var(std::string x,std::unique_ptr<Expr>y):n(std::move(x)),v(std::move(y)){}void exec(std::shared_ptr<Env>e)override{e->vars[n]=v->eval(e);}};
struct Print:Stmt{std::unique_ptr<Expr>v; explicit Print(std::unique_ptr<Expr>x):v(std::move(x)){}void exec(std::shared_ptr<Env>e)override{std::cout<<show(v->eval(e))<<"\n";}};
struct ExprStmt:Stmt{std::unique_ptr<Expr>v; explicit ExprStmt(std::unique_ptr<Expr>x):v(std::move(x)){} void exec(std::shared_ptr<Env>e)override{v->eval(e);}};
struct Return:Stmt{std::unique_ptr<Expr>v; explicit Return(std::unique_ptr<Expr>y):v(std::move(y)){}void exec(std::shared_ptr<Env>e)override{throw ReturnSignal{v->eval(e)};}};
struct Throw:Stmt{std::unique_ptr<Expr>v; explicit Throw(std::unique_ptr<Expr>y):v(std::move(y)){}void exec(std::shared_ptr<Env>e)override{throw Error(show(v->eval(e)));}};

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
  std::unique_ptr<Block>body,handler; std::string name; TryCatch(std::unique_ptr<Block>b,std::unique_ptr<Block>h,std::string n):body(std::move(b)),handler(std::move(h)),name(std::move(n)){}
  void exec(std::shared_ptr<Env>e)override{
    try{body->exec(e);}
    catch(const ReturnSignal&){throw;}
    catch(const BreakSignal&){throw;}
    catch(const ContinueSignal&){throw;}
    catch(const Error&x){auto h=std::make_shared<Env>(e);h->vars[name]=Value(std::string(x.what()));handler->exec(h);}
  }
};
struct If:Stmt{std::unique_ptr<Expr>t;std::unique_ptr<Block>a,b; If(std::unique_ptr<Expr>x,std::unique_ptr<Block>y,std::unique_ptr<Block>z):t(std::move(x)),a(std::move(y)),b(std::move(z)){}void exec(std::shared_ptr<Env>e)override{if(truth(t->eval(e)))a->exec(e);else if(b)b->exec(e);}};
struct While:Stmt{std::unique_ptr<Expr>t;std::unique_ptr<Block>b; While(std::unique_ptr<Expr>x,std::unique_ptr<Block>y):t(std::move(x)),b(std::move(y)){}void exec(std::shared_ptr<Env>e)override{while(truth(t->eval(e))){try{b->exec(e);}catch(BreakSignal&){break;}catch(ContinueSignal&){}}}};
struct Break:Stmt{void exec(std::shared_ptr<Env>)override{throw BreakSignal{};}};
struct Continue:Stmt{void exec(std::shared_ptr<Env>)override{throw ContinueSignal{};}};
struct TargetAssign:Stmt{
  std::unique_ptr<Expr>target; std::string op; std::unique_ptr<Expr>value; TargetAssign(std::unique_ptr<Expr>t,std::string o,std::unique_ptr<Expr>v):target(std::move(t)),op(std::move(o)),value(std::move(v)){}
  void exec(std::shared_ptr<Env>e)override{
    auto rhs=value->eval(e);
    if(auto n=dynamic_cast<Name*>(target.get())){e->set(n->n,applyAssign(op,e->get(n->n),rhs));return;}
    if(auto m=dynamic_cast<Member*>(target.get())){
      auto obj=m->o->eval(e);if(auto ip=std::get_if<std::shared_ptr<Instance>>(&obj.v)){auto inst=*ip;Value old=inst->fields.count(m->k)?inst->fields.at(m->k):Value();inst->fields[m->k]=applyAssign(op,old,rhs);return;}auto p=std::get_if<std::shared_ptr<Value::Object>>(&obj.v);if(!p)throw Error("member assignment requires object or instance");Value old=(*p)->count(m->k)?(*p)->at(m->k):Value();(*p)->operator[](m->k)=applyAssign(op,old,rhs);return;
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
struct FnDecl:Stmt{std::string n;std::vector<std::string>p;std::vector<std::unique_ptr<Stmt>>b; FnDecl(std::string x,std::vector<std::string>q,std::vector<std::unique_ptr<Stmt>>z):n(std::move(x)),p(std::move(q)),b(std::move(z)){}void exec(std::shared_ptr<Env>e)override{auto f=std::make_shared<Function>();f->params=p;f->body=std::move(b);f->closure=e;e->vars[n]=f;}};
struct MethodDef { std::string n; std::vector<std::string> p; std::vector<std::unique_ptr<Stmt>> b; };
struct ClassDecl:Stmt{std::string n,parentName;std::vector<MethodDef>methods; ClassDecl(std::string x,std::string p,std::vector<MethodDef>m):n(std::move(x)),parentName(std::move(p)),methods(std::move(m)){}void exec(std::shared_ptr<Env>e)override{auto c=std::make_shared<Class>();c->name=n;c->closure=e;if(!parentName.empty()){auto pv=e->get(parentName);auto pp=std::get_if<std::shared_ptr<Class>>(&pv.v);if(!pp||!*pp)throw Error("OOPS parent is not a class: "+parentName);c->parent=*pp;}for(auto&d:methods){auto f=std::make_shared<Function>();f->params=d.p;f->body=std::move(d.b);f->closure=e;f->ownerClass=c;c->methods[d.n]=f;}e->vars[n]=c;}};
struct NewExpr:Expr{std::unique_ptr<Expr>klass;std::vector<std::unique_ptr<Expr>>args;Value eval(std::shared_ptr<Env>e)override{auto cv=klass->eval(e);auto cp=std::get_if<std::shared_ptr<Class>>(&cv.v);if(!cp)throw Error("NEW target is not a class");auto inst=std::make_shared<Instance>();inst->klass=*cp;auto it=(*cp)->findMethod("init");std::vector<Value>a;for(auto&x:args)a.push_back(x->eval(e));if(it)it->second->call(a,Value(inst));else if(!a.empty())throw Error("constructor init not found");return inst;}};

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
  if(at("OOPS")){take();auto n=take().text;std::string parent;if(at("EXTENDS")){take();parent=take().text;}need("{");std::vector<MethodDef>ms;while(!at("}")){if(!at("WIZARD"))throw Error("OOPS class body accepts WIZARD methods only");take();auto mn=take().text;need("(");std::vector<std::string>p;if(!at(")")){do{p.push_back(take().text);}while(at(",")&&take().text==",");}need(")");auto b=block();ms.push_back(MethodDef{mn,std::move(p),std::move(b->s)});}need("}");return std::make_unique<ClassDecl>(ClassDecl{n,parent,std::move(ms)});}
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
  if(x.text=="SUPER"){auto n=take().text;return std::make_unique<SuperMember>(n);} if(x.text=="NEW"){auto n=std::make_unique<NewExpr>();n->klass=std::make_unique<Name>(take().text);need("(");if(!at(")")){do{n->args.push_back(expr());}while(at(",")&&take().text==",");}need(")");return n;}
  if(x.kind==Token::ID)return std::make_unique<Name>(x.text);
  if(x.text=="("){auto a=expr();need(")");return a;}
  if(x.text=="["){auto a=std::make_unique<ArrayExpr>();if(!at("]")){do{a->a.push_back(expr());}while(at(",")&&take().text==",");}need("]");return a;}
  if(x.text=="{"){auto a=std::make_unique<ObjectExpr>();if(!at("}")){do{auto k=take().text;need(":");a->p.push_back({k,expr()});}while(at(",")&&take().text==",");}need("}");return a;}
  throw Error("expected expression at "+std::to_string(x.line)+":"+std::to_string(x.col));
 }
};

static std::vector<std::string> gArgs;

static Value nativeArgs(const std::vector<Value>& a){
  if(!a.empty()) throw Error("ARGS expects 0 arguments");
  auto out=std::make_shared<Value::Array>();
  for(const auto& s:gArgs) out->push_back(s);
  return out;
}
static Value nativeTimeMs(const std::vector<Value>& a){
  if(!a.empty()) throw Error("TIME_MS expects 0 arguments");
  auto now=std::chrono::time_point_cast<std::chrono::milliseconds>(
      std::chrono::system_clock::now());
  return (double)now.time_since_epoch().count();
}
static Value nativeSleepMs(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("SLEEP_MS expects 1 argument");
  double ms=num(a[0]);
  if(ms<0) throw Error("SLEEP_MS expects a non-negative number");
  std::this_thread::sleep_for(std::chrono::milliseconds((long long)ms));
  return true;
}
static Value nativeGetEnv(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("ENV expects 1 argument");
  auto k=std::get_if<std::string>(&a[0].v);
  if(!k) throw Error("ENV expects a string key");
  const char* v=std::getenv(k->c_str());
  return v ? Value(std::string(v)) : Value();
}
static Value nativeCwd(const std::vector<Value>& a){
  if(!a.empty()) throw Error("CWD expects 0 arguments");
  try{return std::filesystem::current_path().string();}
  catch(const std::exception&){throw Error("CWD failed");}
}
static Value nativeJoinPath(const std::vector<Value>& a){
  if(a.size()<1) throw Error("JOIN_PATH expects at least 1 argument");
  std::filesystem::path out;
  for(const auto& v:a){
    auto s=std::get_if<std::string>(&v.v);
    if(!s) throw Error("JOIN_PATH expects string arguments");
    out /= *s;
  }
  return out.lexically_normal().string();
}

static std::string readFile(const std::string&f);

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
static Value nativeInstanceOf(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("INSTANCEOF expects 2 arguments");
  auto ip=std::get_if<std::shared_ptr<Instance>>(&a[0].v);
  auto cp=std::get_if<std::shared_ptr<Class>>(&a[1].v);
  if(!ip||!*ip||!cp||!*cp) return false;
  for(auto k=(*ip)->klass;k;k=k->parent) if(k==*cp) return true;
  return false;
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
  if(std::holds_alternative<std::shared_ptr<Class>>(v.v)) return "class";
  if(std::holds_alternative<std::shared_ptr<Instance>>(v.v)) return "instance";
  return std::holds_alternative<std::function<Value(const std::vector<Value>&)>>(v.v) ? "native-function" : "function";
}
static Value nativeAbs(const std::vector<Value>& a){ if(a.size()!=1) throw Error("ABS expects 1 argument"); return std::fabs(num(a[0])); }
static Value nativeSqrt(const std::vector<Value>& a){ if(a.size()!=1) throw Error("SQRT expects 1 argument"); double x=num(a[0]); if(x<0) throw Error("SQRT expects a non-negative number"); return std::sqrt(x); }
static Value nativeFloor(const std::vector<Value>& a){ if(a.size()!=1) throw Error("FLOOR expects 1 argument"); return std::floor(num(a[0])); }
static Value nativeCeil(const std::vector<Value>& a){ if(a.size()!=1) throw Error("CEIL expects 1 argument"); return std::ceil(num(a[0])); }
static Value nativeToString(const std::vector<Value>& a){ if(a.size()!=1) throw Error("TO_STRING expects 1 argument"); return show(a[0]); }
static Value nativeSubstr(const std::vector<Value>& a){
  if(a.size()!=3) throw Error("SUBSTR expects 3 arguments");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("SUBSTR expects a string");
  double start=num(a[1]), len=num(a[2]);
  if(start<0||len<0||std::floor(start)!=start||std::floor(len)!=len) throw Error("SUBSTR indexes must be non-negative integers");
  size_t p=(size_t)start, n=(size_t)len;
  if(p>s->size()) return std::string();
  return s->substr(p,n);
}
static Value nativeUpper(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("UPPER expects 1 argument");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("UPPER expects a string");
  std::string r=*s; for(char& c:r)c=(char)std::toupper((unsigned char)c); return r;
}
static Value nativeLower(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("LOWER expects 1 argument");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("LOWER expects a string");
  std::string r=*s; for(char& c:r)c=(char)std::tolower((unsigned char)c); return r;
}
static Value nativeReadFile(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("READ_FILE expects 1 argument");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("READ_FILE expects a path string");
  return readFile(*s);
}
static Value nativeWriteFile(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("WRITE_FILE expects 2 arguments");
  auto p=std::get_if<std::string>(&a[0].v); auto d=std::get_if<std::string>(&a[1].v);
  if(!p||!d) throw Error("WRITE_FILE expects path and string data");
  std::ofstream out(*p); if(!out) throw Error("cannot write "+*p); out<<*d; return true;
}
static Value nativeExists(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("EXISTS expects 1 argument");
  auto p=std::get_if<std::string>(&a[0].v); if(!p) throw Error("EXISTS expects a path string");
  std::ifstream in(*p); return (bool)in;
}
static Value nativeHas(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("HAS expects 2 arguments");
  if(auto p=std::get_if<std::shared_ptr<Value::Array>>(&a[0].v)){
    double d=num(a[1]); if(d<0||std::floor(d)!=d) return false;
    size_t n=(size_t)d; return n<(*p)->size();
  }
  if(auto p=std::get_if<std::shared_ptr<Value::Object>>(&a[0].v)){
    auto k=std::get_if<std::string>(&a[1].v); if(!k) throw Error("HAS object key must be a string");
    return (*p)->count(*k)>0;
  }
  if(auto p=std::get_if<std::string>(&a[0].v)){
    auto k=std::get_if<std::string>(&a[1].v); if(!k) throw Error("HAS string needle must be a string");
    return p->find(*k)!=std::string::npos;
  }
  throw Error("HAS expects array, object, or string");
}
static Value nativeKeys(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("KEYS expects 1 argument");
  auto p=std::get_if<std::shared_ptr<Value::Object>>(&a[0].v);
  if(!p) throw Error("KEYS expects an object");
  auto out=std::make_shared<Value::Array>();
  for(const auto& kv:**p) out->push_back(kv.first);
  return out;
}
static Value nativeRange(const std::vector<Value>& a){
  if(a.size()<1||a.size()>3) throw Error("RANGE expects 1 to 3 arguments");
  double start=0,end=0,step=1;
  if(a.size()==1){end=num(a[0]);}
  else {start=num(a[0]); end=num(a[1]); if(a.size()==3) step=num(a[2]);}
  if(step==0) throw Error("RANGE step cannot be zero");
  auto out=std::make_shared<Value::Array>();
  if(step>0){for(double x=start;x<end;x+=step)out->push_back(x);}
  else {for(double x=start;x>end;x+=step)out->push_back(x);}
  return out;
}
static Value nativeMin(const std::vector<Value>& a){
  if(a.empty()) throw Error("MIN expects at least 1 argument");
  double r=num(a[0]); for(size_t i=1;i<a.size();++i) r=std::min(r,num(a[i])); return r;
}
static Value nativeMax(const std::vector<Value>& a){
  if(a.empty()) throw Error("MAX expects at least 1 argument");
  double r=num(a[0]); for(size_t i=1;i<a.size();++i) r=std::max(r,num(a[i])); return r;
}
static Value nativePow(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("POW expects 2 arguments");
  return std::pow(num(a[0]),num(a[1]));
}
static Value nativeClamp(const std::vector<Value>& a){
  if(a.size()!=3) throw Error("CLAMP expects 3 arguments");
  double x=num(a[0]), lo=num(a[1]), hi=num(a[2]);
  if(lo>hi) throw Error("CLAMP minimum cannot exceed maximum");
  return std::max(lo,std::min(x,hi));
}
static Value nativeAssert(const std::vector<Value>& a){
  if(a.empty()||a.size()>2) throw Error("ASSERT expects 1 or 2 arguments");
  if(!truth(a[0])) throw Error(a.size()==2 ? show(a[1]) : "ASSERT failed");
  return true;
}
static Value nativeRepeat(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("REPEAT expects 2 arguments");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("REPEAT expects a string");
  double n=num(a[1]); if(n<0||std::floor(n)!=n) throw Error("REPEAT count must be a non-negative integer");
  std::string out; out.reserve(s->size()*(size_t)n);
  for(size_t i=0;i<(size_t)n;++i) out+=*s;
  return out;
}
static Value nativeTrim(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("TRIM expects 1 argument");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("TRIM expects a string");
  size_t b=0,e=s->size();
  while(b<e&&std::isspace((unsigned char)(*s)[b])) ++b;
  while(e>b&&std::isspace((unsigned char)(*s)[e-1])) --e;
  return s->substr(b,e-b);
}
static Value nativeReplace(const std::vector<Value>& a){
  if(a.size()!=3) throw Error("REPLACE expects 3 arguments");
  auto s=std::get_if<std::string>(&a[0].v); auto from=std::get_if<std::string>(&a[1].v); auto to=std::get_if<std::string>(&a[2].v);
  if(!s||!from||!to) throw Error("REPLACE expects string arguments");
  if(from->empty()) return *s;
  std::string out=*s; size_t p=0;
  while((p=out.find(*from,p))!=std::string::npos){out.replace(p,from->size(),*to);p+=to->size();}
  return out;
}
static Value nativeSplit(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("SPLIT expects 2 arguments");
  auto s=std::get_if<std::string>(&a[0].v); auto sep=std::get_if<std::string>(&a[1].v);
  if(!s||!sep) throw Error("SPLIT expects string arguments");
  auto out=std::make_shared<Value::Array>();
  if(sep->empty()){for(unsigned char ch:*s) out->push_back(std::string(1,(char)ch)); return out;}
  size_t p=0,q; while((q=s->find(*sep,p))!=std::string::npos){out->push_back(s->substr(p,q-p));p=q+sep->size();}
  out->push_back(s->substr(p)); return out;
}
static Value nativeJoin(const std::vector<Value>& a){
  if(a.size()!=2) throw Error("JOIN expects 2 arguments");
  auto p=std::get_if<std::shared_ptr<Value::Array>>(&a[0].v); auto sep=std::get_if<std::string>(&a[1].v);
  if(!p||!sep) throw Error("JOIN expects array and string");
  std::string out; for(size_t i=0;i<(*p)->size();++i){if(i)out+=*sep;out+=show((*p)->at(i));} return out;
}
static Value nativeParseNumber(const std::vector<Value>& a){
  if(a.size()!=1) throw Error("NUMBER expects 1 argument");
  auto s=std::get_if<std::string>(&a[0].v); if(!s) throw Error("NUMBER expects a string");
  try{size_t n=0; double x=std::stod(*s,&n); if(n!=s->size()) throw Error("NUMBER could not parse value"); return x;}
  catch(const std::invalid_argument&){throw Error("NUMBER could not parse value");}
  catch(const std::out_of_range&){throw Error("NUMBER is out of range");}
}

static std::string readFile(const std::string&f){std::ifstream in(f);if(!in)throw Error("cannot open "+f);return std::string((std::istreambuf_iterator<char>(in)),{});}
}


static bool gPlainDiagnostics=false;

static std::string chaosDiagnostic(const std::string& message, bool plain=false){
  if(plain) return "GLOP ERROR: "+message;
  std::string code="GLOP-E9999",cat="[CHAOS ENGINE]",what="Something went sideways with great confidence.",
              why="The runtime encountered a condition it could not complete normally.",
              fix="Read the technical detail, inspect the nearby code, and correct the reported condition.";
  if(message.find("unterminated string")!=std::string::npos){code="GLOP-E1001";cat="[SYNTAX GOBLIN]";what="THE QUOTE ESCAPED. THE STRING DID NOT.";why="A string started with a quote but no matching closing quote was found.";fix="Close the string with the matching quote. Check the line for an accidental quote or missing delimiter.";}
  else if(message.find("unexpected character")!=std::string::npos){code="GLOP-E1002";cat="[CHARACTER MUTINY]";what="A CHARACTER JUST WALKED INTO THE COMPILER UNINVITED.";why="The lexer found a character that is not valid GLOP syntax.";fix="Remove it or replace it with valid GLOP punctuation, an operator, a keyword, or a string.";}
  else if(message.find("expected ")==0){code="GLOP-E1003";cat="[PARSER PANIC]";what="THE PARSER WANTED ONE THING AND GOT ABSOLUTELY ANOTHER.";why="The source structure does not match the grammar GLOP expected at that point.";fix="Inspect the reported location. Check missing braces, parentheses, commas, operators, or keywords.";}
  else if(message.find("undefined variable")!=std::string::npos){code="GLOP-E2001";cat="[NAME GOBLIN]";what="THAT NAME DOES NOT EXIST IN THIS UNIVERSE.";why="The program tried to read a variable that is not defined in the current scope or its parents.";fix="Declare it with GLOP, check spelling, or verify that you are using the variable inside the correct scope.";}
  else if(message.find("wrong argument count")!=std::string::npos){code="GLOP-E2002";cat="[BONK MISFIRE]";what="THE FUNCTION WAS BONKED WITH THE WRONG NUMBER OF ARGUMENTS.";why="The number of supplied arguments does not match the WIZARD's parameters.";fix="Count the parameters and arguments. Pass exactly the number the function declares.";}
  else if(message.find("division by zero")!=std::string::npos){code="GLOP-E3001";cat="[MATH GREMLIN]";what="ZERO HAS ENTERED THE DENOMINATOR. MATHEMATICS HAS FILED A COMPLAINT.";why="The right-hand side of division evaluated to zero.";fix="Check the divisor before dividing. Use SUS to handle the zero case.";}
  else if(message.find("array index out of range")!=std::string::npos){code="GLOP-E3002";cat="[INDEX CANNON]";what="YOU FIRED AN INDEX INTO EMPTY SPACE.";why="The requested array position is outside the valid range.";fix="Check LEN(array), and remember that array indexes start at 0.";}
  else if(message.find("expected number")!=std::string::npos){code="GLOP-E3003";cat="[NUMBER GOBLIN]";what="A NUMBER WAS REQUESTED. SOMETHING ELSE ARRIVED WEARING A FAKE MUSTACHE.";why="An arithmetic or numeric operation received a non-number value.";fix="Check TYPE(value) and convert or validate the value before using numeric operators.";}
  else if(message.find("not a class")!=std::string::npos || message.find("unknown instance member")!=std::string::npos){code="GLOP-E4001";cat="[OOPS CLASS DISASTER]";what="THE OBJECT-ORIENTED UNIVERSE HAS REJECTED YOUR REQUEST.";why="NEW or member access was used with the wrong kind of value or an unknown member.";fix="Check TYPE(value), the OOPS declaration, field names, and WIZARD methods.";}
  else if(message.find("not a function")!=std::string::npos){code="GLOP-E4002";cat="[BONK TARGET DISASTER]";what="YOU BONKED SOMETHING THAT IS NOT A FUNCTION.";why="The value being called is not a WIZARD/function.";fix="Check TYPE(target), the declaration, and whether the variable was overwritten.";}
  else if(message.find("invalid assignment")!=std::string::npos){code="GLOP-E2004";cat="[ASSIGNMENT CHAOS]";what="YOU TRIED TO STICK A VALUE SOMEWHERE THAT IS NOT STICKABLE.";why="The left side of the assignment is not a variable, member, or array element.";fix="Assign to a GLOP variable, object member, or valid array index.";}
  else if(message.find("cannot open")!=std::string::npos){code="GLOP-E5001";cat="[FILE GOBLIN]";what="THE FILE DOOR IS LOCKED AND GLOP DOES NOT HAVE THE KEY.";why="The requested file could not be opened.";fix="Check the path, working directory, permissions, and whether the file exists.";}
  std::string s=code+" "+cat+"\n\n  WHAT HAPPENED\n  "+what+"\n\n  WHY THIS MAY HAVE HAPPENED\n  "+why+"\n\n  WHAT CAN BE DONE\n  "+fix+"\n\n  TECHNICAL DETAIL\n  "+message+"\n\n  CHAOS REPORT\n  GLOP → PANIC → DIAGNOSE → FIX → BONK AGAIN";
  return s;
}
static void printChaosSuccess(const std::string&what, bool plain=false){
  if(plain) std::cout<<"GLOP OK: "<<what<<"\n";
  else std::cout<<"[SUCCESS: SOMEHOW]\n  "<<what<<"\n  CHAOS ENGINE: SURVIVED\n";
}

int main(int argc,char**argv){
  try{
    std::vector<std::string> positional;
    for(int ai=1;ai<argc;++ai){
      std::string arg=argv[ai];
      if(arg=="--plain"){gPlainDiagnostics=true;continue;}
      if(arg=="--help"||arg=="-h"){
        std::cout<<"GLOP 0.7.0 native runtime — CHAOS MODE ENABLED\\n";
        std::cout<<"usage: glop [--plain] <program.glop> [args...]\\n";
        std::cout<<"       glop [--plain] check <program.glop>\\n";
        std::cout<<"       glop --version\\n";
        std::cout<<"built-ins: LEN PUSH POP TYPE INSTANCEOF ABS SQRT FLOOR CEIL TO_STRING SUBSTR UPPER LOWER READ_FILE WRITE_FILE EXISTS HAS KEYS RANGE NUMBER ARGS TIME_MS SLEEP_MS ENV CWD JOIN_PATH MIN MAX POW CLAMP ASSERT REPEAT TRIM REPLACE SPLIT JOIN\\n";
        std::cout<<"diagnostics: chaotic by default; use --plain for boring machine-friendly output\\n";
        return 0;
      }
      if(arg=="--version"||arg=="-v"){std::cout<<"GLOP 0.7.0 native runtime\\n";return 0;}
      positional.push_back(std::move(arg));
    }
    if(positional.empty()){std::cerr<<"usage: glop [--plain] <program.glop> [args...]\\n";return 2;}
    bool checkOnly=positional[0]=="check";
    bool runCommand=positional[0]=="run";
    size_t pathIndex=(checkOnly||runCommand)?1:0;
    if(positional.size()<=pathIndex) throw glop::Error(checkOnly ? "usage: glop check <program.glop>" : "missing program.glop path");
    if(checkOnly && positional.size()!=2) throw glop::Error("usage: glop check <program.glop>");
    if(runCommand && positional.size()<2) throw glop::Error("usage: glop run <program.glop> [args...]");
    const std::string& sourcePath=positional[pathIndex];
    glop::gArgs.assign(positional.begin()+pathIndex+1,positional.end());
    auto ast=glop::Parser(glop::Lexer(glop::readFile(sourcePath)).all()).program();
    if(checkOnly){
      printChaosSuccess("SOURCE CHECKED. NO GOBLINS FOUND.", gPlainDiagnostics);
      return 0;
    }
    auto env=std::make_shared<glop::Env>();
    env->vars["LEN"]=glop::Value(glop::nativeLen);
    env->vars["PUSH"]=glop::Value(glop::nativePush);
    env->vars["POP"]=glop::Value(glop::nativePop);
    env->vars["TYPE"]=glop::Value(glop::nativeType);
    env->vars["INSTANCEOF"]=glop::Value(glop::nativeInstanceOf);
    env->vars["ABS"]=glop::Value(glop::nativeAbs);
    env->vars["SQRT"]=glop::Value(glop::nativeSqrt);
    env->vars["FLOOR"]=glop::Value(glop::nativeFloor);
    env->vars["CEIL"]=glop::Value(glop::nativeCeil);
    env->vars["TO_STRING"]=glop::Value(glop::nativeToString);
    env->vars["SUBSTR"]=glop::Value(glop::nativeSubstr);
    env->vars["UPPER"]=glop::Value(glop::nativeUpper);
    env->vars["LOWER"]=glop::Value(glop::nativeLower);
    env->vars["READ_FILE"]=glop::Value(glop::nativeReadFile);
    env->vars["WRITE_FILE"]=glop::Value(glop::nativeWriteFile);
    env->vars["EXISTS"]=glop::Value(glop::nativeExists);
    env->vars["HAS"]=glop::Value(glop::nativeHas);
    env->vars["KEYS"]=glop::Value(glop::nativeKeys);
    env->vars["RANGE"]=glop::Value(glop::nativeRange);
    env->vars["NUMBER"]=glop::Value(glop::nativeParseNumber);
    env->vars["ARGS"]=glop::Value(glop::nativeArgs);
    env->vars["TIME_MS"]=glop::Value(glop::nativeTimeMs);
    env->vars["SLEEP_MS"]=glop::Value(glop::nativeSleepMs);
    env->vars["ENV"]=glop::Value(glop::nativeGetEnv);
    env->vars["CWD"]=glop::Value(glop::nativeCwd);
    env->vars["JOIN_PATH"]=glop::Value(glop::nativeJoinPath);
    env->vars["MIN"]=glop::Value(glop::nativeMin);
    env->vars["MAX"]=glop::Value(glop::nativeMax);
    env->vars["POW"]=glop::Value(glop::nativePow);
    env->vars["CLAMP"]=glop::Value(glop::nativeClamp);
    env->vars["ASSERT"]=glop::Value(glop::nativeAssert);
    env->vars["REPEAT"]=glop::Value(glop::nativeRepeat);
    env->vars["TRIM"]=glop::Value(glop::nativeTrim);
    env->vars["REPLACE"]=glop::Value(glop::nativeReplace);
    env->vars["SPLIT"]=glop::Value(glop::nativeSplit);
    env->vars["JOIN"]=glop::Value(glop::nativeJoin);
    for(auto&s:ast)s->exec(env);
    return 0;
  }catch(const glop::Error&e){std::cerr<<chaosDiagnostic(e.what(), gPlainDiagnostics)<<"\n";return 1;}
  catch(const glop::ReturnSignal&){std::cerr<<"GLOP-E2003 [YEET CRIME]\\n  YEET ESCAPED A WIZARD. THIS IS NOT A NORMAL EXIT.\\n  Technical: YEET outside WIZARD\\n";return 1;}
  catch(...){std::cerr<<chaosDiagnostic("unknown runtime failure", plain)<<"\n";return 1;}
}
