import{node as makeNode}from"./ast.js";

const node=(type,props={})=>makeNode(type,{...props,loc:props.loc??Parser.currentLocation??null});

export class GlopParseError extends Error{
 constructor(message,t,code="PARSE_ERROR"){
  super(`${message} at ${t.line}:${t.column}`);
  this.name="GlopParseError";
  this.code=code;
  this.line=t.line;
  this.column=t.column;
 }
}

export class Parser{
 constructor(tokens,{maxExpressionDepth=1000,maxCallArgs=256,maxArrayElements=4096,maxObjectProperties=4096,maxParameters=256,maxStatements=100000}={}){this.tokens=tokens;this.i=0;this.maxExpressionDepth=maxExpressionDepth;this.maxCallArgs=maxCallArgs;this.maxArrayElements=maxArrayElements;this.maxObjectProperties=maxObjectProperties;this.maxParameters=maxParameters;this.maxStatements=maxStatements;this.expressionDepth=0;this.statementCount=0}
 peek(){return this.tokens[this.i]}
 advance(){return this.tokens[this.i++]}
 prev(){return this.tokens[this.i-1]}
 check(v){const t=this.peek();return !!t&&(t.value===v||t.type===v)}
 match(v){if(this.check(v))return this.advance();return null}
 expect(v,m=`Expected ${v}`){if(!this.check(v))throw new GlopParseError(m,this.peek());return this.advance()}

 parse(){
  const body=[];
  while(!this.check("eof"))body.push(this.statement())
  return node("Program",{body});
 }

 block(){
  this.expect("{");
  const body=[];
  while(!this.check("}")&&!this.check("eof"))body.push(this.statement());
  this.expect("}","Expected } to close block");
  return body;
 }

 statement(){
  if(++this.statementCount>this.maxStatements)throw new GlopParseError(`Maximum statement count (${this.maxStatements}) exceeded`,this.peek(),"PARSE_LIMIT");
  const t=this.peek();
  Parser.currentLocation={line:t.line,column:t.column};

  if(this.match("STEAL")){
   const path=this.expect("string","STEAL requires a module path string").value;
   const as=this.expect("identifier","STEAL requires AS <alias>");
   if(as.value!=="AS")throw new GlopParseError("STEAL requires AS <alias>",as);
   const alias=this.expect("identifier","Expected module alias").value;
   this.match(";");
   return node("ImportDecl",{path,alias});
  }

  if(this.match("FLEX")){
   const names=[this.expect("identifier","FLEX requires an exported name").value];
   while(this.match(",")){
    if(this.check(";")||this.check("eof"))throw new GlopParseError("Expected exported name after comma",this.peek());
    names.push(this.expect("identifier","Expected exported name").value);
   }
   this.match(";");
   return node("ExportDecl",{names});
  }

  if(this.match("GLOP")){
   const name=this.expect("identifier","Expected variable name").value;
   this.expect("=","Expected = after variable name");
   const value=this.expression();
   this.match(";");
   return node("VarDecl",{name,value});
  }

  if(this.match("YAP")){
   const expression=this.expression();
   this.match(";");
   return node("Print",{expression});
  }

  if(this.match("SUS")){
   const test=this.expression(),consequent=this.block();
   let alternate=null;
   if(this.match("NAH"))alternate=this.block();
   return node("If",{test,consequent,alternate});
  }

  if(this.match("SPIN")){
   const test=this.expression(),body=this.block();
   return node("While",{test,body});
  }

  if(this.match("WIZARD")){
   const name=this.expect("identifier","Expected function name").value;
   const params=this.finishParameterList();
   return node("FunctionDecl",{name,params,body:this.block()});
  }

  if(this.match("YEET")){
   const value=this.check("}")?node("Literal",{value:null}):this.expression();
   this.match(";");
   return node("Return",{value});
  }

  if(this.match("OOPSIE")){
   const value=this.expression();
   this.match(";");
   return node("Throw",{value});
  }

  if(this.match("TRY")){
   const tryBody=this.block();
   this.expect("CATCH","Expected CATCH after TRY block");
   const param=this.expect("identifier","Expected catch parameter").value;
   return node("TryCatch",{tryBody,param,catchBody:this.block()});
  }

  if(this.match("NOPE")){this.match(";");return node("Break")}
  if(this.match("ZOOM")){this.match(";");return node("Continue")}

  const expression=this.expression();

  if(this.peek().type==="operator"&&["+=","-=","*=","/="].includes(this.peek().value)){
   const op=this.advance().value,value=this.expression();
   this.match(";");
   return node("Assignment",{target:expression,op,value});
  }

  if(this.match("=")){
   const value=this.expression();
   this.match(";");
   return node("Assignment",{target:expression,op:"=",value});
  }

  this.match(";");
  return node("ExpressionStatement",{expression});
 }

 finishParameterList(){
  this.expect("(","Expected ( before parameter list");
  const params=[];
  if(this.check(")")){this.advance();return params}
  while(true){
   if(this.check(",")||this.check("eof"))throw new GlopParseError("Expected parameter",this.peek());
   if(params.length>=this.maxParameters)throw new GlopParseError(`Maximum parameter count (${this.maxParameters}) exceeded`,this.peek(),"PARSE_LIMIT");   params.push(this.expect("identifier","Expected parameter name").value);
   if(this.match(")"))break;
   this.expect(",","Expected , or ) after parameter");
   if(this.check(")")){this.advance();break}
  }
  return params;
 }

 expression(){
  const t=this.peek();
  Parser.currentLocation={line:t.line,column:t.column};
  if(++this.expressionDepth>this.maxExpressionDepth){
   this.expressionDepth--;
   throw new GlopParseError(`Maximum expression nesting depth (${this.maxExpressionDepth}) exceeded`,t,"PARSE_LIMIT");
  }
  try{return this.binary(0)}finally{this.expressionDepth--}
 }

 binary(min){
  let left=this.unary();
  const p={"||":1,"&&":2,"==":3,"!=":3,"<":4,">":4,"<=":4,">=":4,"+":5,"-":5,"*":6,"/":6,"%":6};
  while(this.peek().type==="operator"&&p[this.peek().value]>=min){
   const op=this.advance().value;
   left=node("Binary",{left,op,right:this.binary(p[op]+1)});
  }
  return left;
 }

 unary(){
  if(this.match("!"))return node("Unary",{op:"!",argument:this.unary()});
  if(this.match("-"))return node("Unary",{op:"-",argument:this.unary()});
  return this.postfix(this.primary());
 }

 postfix(e){
  for(;;){
   if(this.check("(")){e=this.finishCall(e);continue}
   if(this.match("[")){e=this.finishIndex(e);continue}
   if(this.match(".")){
    const property=this.expect("identifier","Expected member name after .").value;
    e=node("Member",{object:e,property});
    continue;
   }
   break;
  }
  return e;
 }

 finishCall(callee){
  this.expect("(");
  const args=[];
  if(this.check(")")){this.advance();return node("Call",{callee,args})}

  while(true){
   if(this.check(",")||this.check(")")||this.check("eof"))
    throw new GlopParseError("Expected expression for call argument",this.peek());

   if(args.length>=this.maxCallArgs)throw new GlopParseError(`Maximum call argument count (${this.maxCallArgs}) exceeded`,this.peek(),"PARSE_LIMIT");   args.push(this.expression());

   if(this.match(")"))break;
   this.expect(",","Expected , or ) after call argument");

   // A trailing comma is valid; a second comma is not.
   if(this.match(")"))break;
   if(this.check(",")||this.check("eof"))
    throw new GlopParseError("Expected expression after comma",this.peek());
  }

  return node("Call",{callee,args});
 }

 finishIndex(object){
  if(this.check("]"))throw new GlopParseError("Expected index expression",this.peek());
  const index=this.expression();
  this.expect("]","Expected ] after index expression");
  return node("Index",{object,index});
 }

 finishCallee(){
  let callee=this.primary();
  for(;;){
   if(this.match(".")){
    const property=this.expect("identifier","Expected member name after .").value;
    callee=node("Member",{object:callee,property});
    continue;
   }
   if(this.match("[")){
    callee=this.finishIndex(callee);
    continue;
   }
   break;
  }
  return callee;
 }

 primary(){
  const t=this.peek();

  if(this.match("number")||this.match("string"))return node("Literal",{value:t.value});
  if(this.match("WIZARD")){
   const params=this.finishParameterList();
   return node("FunctionExpr",{name:"<anonymous>",params,body:this.block()});
  }\n  if(this.match("THIS"))return node("Identifier",{name:"THIS"});
  if(this.match("BASED"))return node("Literal",{value:true});
  if(this.match("CAP"))return node("Literal",{value:false});
  if(this.match("VOID"))return node("Literal",{value:null});

  // BONK explicitly marks a call, while postfix() handles subsequent calls/chaining.
  if(this.match("BONK"))return this.finishCall(this.finishCallee());

  if(t?.type==="identifier"||/^[A-Z_][A-Z0-9_]*$/.test(String(t.value))){
   this.advance();
   return node("Identifier",{name:t.value});
  }

  if(this.match("(")){
   if(this.check(")"))throw new GlopParseError("Expected expression inside ( )",this.peek());
   const e=this.expression();
   this.expect(")","Expected ) after expression");
   return e;
  }

  if(this.match("[")){
   const elements=[];
   if(!this.check("]")){
    while(true){
     if(this.check(",")||this.check("]")||this.check("eof"))
      throw new GlopParseError("Expected array element",this.peek());
     if(elements.length>=this.maxArrayElements)throw new GlopParseError(`Maximum array element count (${this.maxArrayElements}) exceeded`,this.peek(),"PARSE_LIMIT");     elements.push(this.expression());
     if(this.match("]"))break;
     this.expect(",","Expected , or ] after array element");
     if(this.match("]"))break;
     if(this.check(",")||this.check("eof"))
      throw new GlopParseError("Expected array element after comma",this.peek());
    }
   }else this.advance();
   return node("Array",{elements});
  }

  if(this.match("{")){
   const properties=[];
   if(!this.check("}")){
    while(true){
     if(this.check(",")||this.check("}")||this.check("eof"))
      throw new GlopParseError("Expected object property name",this.peek());
     const key=this.expect("identifier","Expected object property name").value;
     this.expect(":","Expected : after object property name");
     if(properties.length>=this.maxObjectProperties)throw new GlopParseError(`Maximum object property count (${this.maxObjectProperties}) exceeded`,this.peek(),"PARSE_LIMIT");     properties.push({key,value:this.expression()});
     if(this.match("}"))break;
     this.expect(",","Expected , or } after object property");
     if(this.match("}"))break;
     if(this.check(",")||this.check("eof"))
      throw new GlopParseError("Expected object property after comma",this.peek());
    }
   }else this.advance();
   return node("Object",{properties});
  }

  throw new GlopParseError("Expected expression",t);
 }
}

Parser.currentLocation=null;
export const parse=(tokens,options)=>new Parser(tokens,options).parse();
