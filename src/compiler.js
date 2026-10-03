import{GLOP_RUNTIME}from"./runtime.js";
const ind=(s,n=1)=>s.split("\n").map(x=>x?"  ".repeat(n)+x:x).join("\n");
export class Compiler{
 compile(p){return GLOP_RUNTIME+"\n"+this.program(p)+"\n"}
 program(n){return n.body.map(x=>this.statement(x)).join("\n")}
 statement(n){switch(n.type){
 case"VarDecl":return`let ${n.name}=${this.expr(n.value)};`;
 case"Print":return`__glop.yap(${this.expr(n.expression)});`;
 case"ExpressionStatement":return this.expr(n.expression)+";";
 case"Assignment":return`${this.expr(n.target)} ${n.op} ${this.expr(n.value)};`;
 case"If":return`if(${this.expr(n.test)}){\n${ind(n.consequent.map(x=>this.statement(x)).join("\n"))}\n}`+(n.alternate?`else{\n${ind(n.alternate.map(x=>this.statement(x)).join("\n"))}\n}`:"");
 case"While":return`while(${this.expr(n.test)}){\n${ind(n.body.map(x=>this.statement(x)).join("\n"))}\n}`;
 case"FunctionDecl":return`function ${n.name}(${n.params.join(",")}){\n${ind(n.body.map(x=>this.statement(x)).join("\n"))}\n}`;
 case"Return":return`return ${this.expr(n.value)};`;
 case"Throw":return`throw ${this.expr(n.value)};`;
 case"TryCatch":return`try{\n${ind(n.tryBody.map(x=>this.statement(x)).join("\n"))}\n}catch(${n.param}){\n${ind(n.catchBody.map(x=>this.statement(x)).join("\n"))}\n}`;
 case"Break":return"break;";case"Continue":return"continue;";
 default:throw new Error("Unknown statement "+n.type)}}
 expr(n){switch(n.type){
 case"Literal":return JSON.stringify(n.value);case"Identifier":return n.name;
 case"Unary":return`(${n.op}${this.expr(n.argument)})`;case"Binary":return`(${this.expr(n.left)} ${n.op} ${this.expr(n.right)})`;
 case"Call":return`${this.expr(n.callee)}(${n.args.map(x=>this.expr(x)).join(",")})`;\n case"FunctionExpr":return`function(${n.params.join(",")}){\n${ind(n.body.map(x=>this.statement(x)).join("\n"))}\n}`;
 case"Index":return`${this.expr(n.object)}[${this.expr(n.index)}]`;
 case"Member":return`${this.expr(n.object)}.${n.property}`;
 case"Array":return`[${n.elements.map(x=>this.expr(x)).join(",")}]`;
 case"Object":return`({${n.properties.map(p=>JSON.stringify(p.key)+":"+this.expr(p.value)).join(",")}})`;
 default:throw new Error("Unknown expression "+n.type)}}
}
export const compile=ast=>new Compiler().compile(ast);