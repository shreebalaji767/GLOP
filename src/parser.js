import{node as makeNode}from"./ast.js";
const node=(type,props={})=>makeNode(type,{...props,loc:props.loc??Parser.currentLocation??null});
export class GlopParseError extends Error{constructor(message,t){super(`${message} at ${t.line}:${t.column}`);}}
export class Parser{
 constructor(tokens){this.tokens=tokens;this.i=0} peek(){return this.tokens[this.i]} advance(){return this.tokens[this.i++]} prev(){return this.tokens[this.i-1]}
 check(v){const t=this.peek();return t.value===v||t.type===v} match(v){if(this.check(v))return this.advance();return null}
 expect(v,m=`Expected ${v}`){if(!this.check(v))throw new GlopParseError(m,this.peek());return this.advance()}
 parse(){const body=[];while(!this.check("eof"))body.push(this.statement());return node("Program",{body})}
 block(){this.expect("{");const body=[];while(!this.check("}")&&!this.check("eof"))body.push(this.statement());this.expect("}");return body}
 statement(){
  const t=this.peek(); Parser.currentLocation={line:t.line,column:t.column};
  if(this.match("STEAL")){
   const path=this.expect("string","STEAL requires a module path string").value;
   const as=this.expect("identifier","STEAL requires AS <alias>");
   if(as.value!=="AS")throw new GlopParseError("STEAL requires AS <alias>",as);
   const alias=this.expect("identifier","Expected module alias").value;
   this.match(";");return node("ImportDecl",{path,alias});
  }
  if(this.match("FLEX")){
   const names=[this.expect("identifier","FLEX requires an exported name").value];
   while(this.match(","))names.push(this.expect("identifier","Expected exported name").value);
   this.match(";");return node("ExportDecl",{names});
  }
  if(this.match("GLOP")){const name=this.expect("identifier","Expected variable name").value;this.expect("=");const value=this.expression();this.match(";");return node("VarDecl",{name,value})}
  if(this.match("YAP")){const expression=this.expression();this.match(";");return node("Print",{expression})}
  if(this.match("SUS")){const test=this.expression(),consequent=this.block();let alternate=null;if(this.match("NAH"))alternate=this.block();return node("If",{test,consequent,alternate})}
  if(this.match("SPIN")){const test=this.expression(),body=this.block();return node("While",{test,body})}
  if(this.match("WIZARD")){const name=this.expect("identifier","Expected function name").value;this.expect("(");const params=[];if(!this.check(")")){do params.push(this.expect("identifier","Expected parameter").value);while(this.match(","))}this.expect(")");return node("FunctionDecl",{name,params,body:this.block()})}
  if(this.match("YEET")){const value=this.check("}")?node("Literal",{value:null}):this.expression();this.match(";");return node("Return",{value})}
  if(this.match("OOPSIE")){const value=this.expression();this.match(";");return node("Throw",{value})}
  if(this.match("TRY")){const tryBody=this.block();this.expect("CATCH");const param=this.expect("identifier").value;return node("TryCatch",{tryBody,param,catchBody:this.block()})}
  if(this.match("NOPE")){this.match(";");return node("Break")}
  if(this.match("ZOOM")){this.match(";");return node("Continue")}
  const expression=this.expression();
  if(this.peek().type==="operator"&&["+=","-=","*=","/="].includes(this.peek().value)){const op=this.advance().value,value=this.expression();this.match(";");return node("Assignment",{target:expression,op,value})}
  if(this.match("=")){const value=this.expression();this.match(";");return node("Assignment",{target:expression,op:"=",value})}
  this.match(";");return node("ExpressionStatement",{expression})
 }
 expression(){Parser.currentLocation={line:this.peek().line,column:this.peek().column};return this.binary(0)}
 binary(min){let left=this.unary();const p={"||":1,"&&":2,"==":3,"!=":3,"<":4,">":4,"<=":4,">=":4,"+":5,"-":5,"*":6,"/":6,"%":6};while(this.peek().type==="operator"&&p[this.peek().value]>=min){const op=this.advance().value;left=node("Binary",{left,op,right:this.binary(p[op]+1)})}return left}
 unary(){if(this.match("!"))return node("Unary",{op:"!",argument:this.unary()});if(this.match("-"))return node("Unary",{op:"-",argument:this.unary()});return this.postfix(this.primary())}
 postfix(e){for(;;){if(this.match("(")){const args=[];if(!this.check(")")){do args.push(this.expression());while(this.match(","))}this.expect(")");e=node("Call",{callee:e,args});continue}if(this.match("[")){const index=this.expression();this.expect("]");e=node("Index",{object:e,index});continue}if(this.match(".")){e=node("Member",{object:e,property:this.expect("identifier").value});continue}break}return e}
 primary(){
  const t=this.peek();
  if(t?.line===1&&t?.column===34)console.log("PRIMARY34",JSON.stringify(t),t?.type==="identifier",/^[A-Z_][A-Z0-9_]*$/.test(String(t?.value)));
  if(this.match("number")||this.match("string"))return node("Literal",{value:t.value});
  if(this.match("BASED"))return node("Literal",{value:true});if(this.match("CAP"))return node("Literal",{value:false});if(this.match("VOID"))return node("Literal",{value:null});
  if(this.match("BONK")){let callee=this.primary();for(;;){if(this.match(".")){callee=node("Member",{object:callee,property:this.expect("identifier").value});continue}if(this.match("[")){const index=this.expression();this.expect("]");callee=node("Index",{object:callee,index});continue}break}this.expect("(");const args=[];if(!this.check(")")){do args.push(this.expression());while(this.match(","))}this.expect(")");return node("Call",{callee,args})}
  if(t?.type==="identifier"||/^[A-Z_][A-Z0-9_]*$/.test(String(t.value))){this.advance();return node("Identifier",{name:t.value});}
  if(this.match("(")){const e=this.expression();this.expect(")");return e}
  if(this.match("[")){const elements=[];if(!this.check("]")){do elements.push(this.expression());while(this.match(","))}this.expect("]");return node("Array",{elements})}
  if(this.match("{")){const properties=[];if(!this.check("}")){do{const key=this.expect("identifier").value;this.expect(":");properties.push({key,value:this.expression()})}while(this.match(","))}this.expect("}");return node("Object",{properties})}
  throw new GlopParseError("Expected expression",t)
 }
}
Parser.currentLocation=null;
export const parse=tokens=>new Parser(tokens).parse();