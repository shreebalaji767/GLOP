export const OP={
 CONST:"CONST",LOAD_GLOBAL:"LOAD_GLOBAL",STORE_GLOBAL:"STORE_GLOBAL",
 LOAD_LOCAL:"LOAD_LOCAL",STORE_LOCAL:"STORE_LOCAL",
 MAKE_FUNCTION:"MAKE_FUNCTION",CALL:"CALL",RETURN:"RETURN",
 ADD:"ADD",SUB:"SUB",MUL:"MUL",DIV:"DIV",MOD:"MOD",
 EQ:"EQ",NE:"NE",LT:"LT",LTE:"LTE",GT:"GT",GTE:"GTE",
 NOT:"NOT",NEG:"NEG",JUMP:"JUMP",JUMP_IF_FALSE:"JUMP_IF_FALSE",
 PRINT:"PRINT",POP:"POP",HALT:"HALT"
};

export class BytecodeBuilder{
 constructor(){this.code=[];this.constants=[];this.functions=[]}
 constant(v){const i=this.constants.findIndex(x=>Object.is(x,v));if(i>=0)return i;this.constants.push(v);return this.constants.length-1}
 emit(op,arg=null){const i=this.code.length;this.code.push({op,arg});return i}
 patch(i,arg){this.code[i].arg=arg}
 addFunction(fn){const i=this.functions.length;this.functions.push(fn);return i}
}