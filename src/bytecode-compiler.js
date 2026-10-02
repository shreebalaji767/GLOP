import {BytecodeBuilder,OP} from "./bytecode.js";

export class BytecodeCompiler{
 constructor(){this.b=new BytecodeBuilder()}
 compile(program){for(const s of program.body)this.statement(s);this.b.emit(OP.CONST,this.b.constant(null));this.b.emit(OP.HALT);return this.b}
 statement(n){
  switch(n.type){
   case"VarDecl":this.expr(n.value);this.b.emit(OP.STORE_GLOBAL,n.name);break;
   case"Print":this.expr(n.expression);this.b.emit(OP.PRINT);break;
   case"ExpressionStatement":this.expr(n.expression);this.b.emit(OP.POP);break;
   case"Assignment":this.expr(n.value);this.b.emit(OP.STORE_GLOBAL,n.target.name);break;
   case"If":{this.expr(n.test);const j=this.b.emit(OP.JUMP_IF_FALSE,null);for(const s of n.consequent)this.statement(s);if(n.alternate){const j2=this.b.emit(OP.JUMP,null);this.b.patch(j,this.b.code.length);for(const s of n.alternate)this.statement(s);this.b.patch(j2,this.b.code.length)}else this.b.patch(j,this.b.code.length);break}
   default:throw new Error("Bytecode backend does not yet support "+n.type);
  }
 }
 expr(n){
  switch(n.type){
   case"Literal":this.b.emit(OP.CONST,this.b.constant(n.value));break;
   case"Identifier":this.b.emit(OP.LOAD_GLOBAL,n.name);break;
   case"Unary":this.expr(n.argument);this.b.emit(n.op==="!"?OP.NOT:OP.NEG);break;
   case"Binary":this.expr(n.left);this.expr(n.right);this.b.emit({"+":OP.ADD,"-":OP.SUB,"*":OP.MUL,"/":OP.DIV,"%":OP.MOD,"==":OP.EQ,"!=":OP.NE,"<":OP.LT,"<=":OP.LTE,">":OP.GT,">=":OP.GTE}[n.op]);break;
   default:throw new Error("Bytecode backend does not yet support "+n.type);
  }
 }
}
export const compileBytecode=ast=>new BytecodeCompiler().compile(ast);