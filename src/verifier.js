import { OP } from "./bytecode.js";

const jumpOps=new Set([OP.JUMP,OP.JUMP_IF_FALSE,OP.JUMP_IF_TRUE]);

export class GlopBytecodeError extends Error {
  constructor(message){super("GLOP BYTECODE OOPSIE: "+message);this.name="GlopBytecodeError";}
}

export function verifyChunk(chunk,path="<main>"){
  if(!chunk||!Array.isArray(chunk.code)||!Array.isArray(chunk.constants)||!Array.isArray(chunk.functions))
    throw new GlopBytecodeError(path+" is not a valid bytecode chunk");
  const locals=Object.values(chunk.localNames??{});
  for(const index of locals) if(!Number.isInteger(index)||index<0) throw new GlopBytecodeError(path+" has an invalid local slot");
  const freeCount=(chunk.freeNames??[]).length;
  for(let i=0;i<chunk.code.length;i++){
    const ins=chunk.code[i];
    if(!ins||!Object.values(OP).includes(ins.op)) throw new GlopBytecodeError(path+" instruction "+i+" has an unknown opcode");
    if(ins.arg!=null&&!Number.isInteger(ins.arg)&&typeof ins.arg!=="string") throw new GlopBytecodeError(path+" instruction "+i+" has an invalid argument");
    if(jumpOps.has(ins.op)){
      if(!Number.isInteger(ins.arg)||ins.arg<0||ins.arg>=chunk.code.length) throw new GlopBytecodeError(path+" instruction "+i+" has an invalid jump target");
    }
    if([OP.CONST,OP.MAKE_FUNCTION,OP.MAKE_CLOSURE,OP.LOAD_LOCAL,OP.STORE_LOCAL,OP.LOAD_FREE,OP.STORE_FREE,OP.CALL,OP.MAKE_ARRAY,OP.MAKE_OBJECT].includes(ins.op)){
      if(!Number.isInteger(ins.arg)||ins.arg<0) throw new GlopBytecodeError(path+" instruction "+i+" requires a non-negative integer operand");
    }
    if(ins.op===OP.CONST&&ins.arg>=chunk.constants.length) throw new GlopBytecodeError(path+" instruction "+i+" references a missing constant");
    if((ins.op===OP.MAKE_FUNCTION||ins.op===OP.MAKE_CLOSURE)&&ins.arg>=chunk.functions.length) throw new GlopBytecodeError(path+" instruction "+i+" references a missing function");
    if((ins.op===OP.LOAD_FREE||ins.op===OP.STORE_FREE)&&ins.arg>=freeCount) throw new GlopBytecodeError(path+" instruction "+i+" references a missing free variable");
    if((ins.op===OP.LOAD_LOCAL||ins.op===OP.STORE_LOCAL)&&!locals.includes(ins.arg)) throw new GlopBytecodeError(path+" instruction "+i+" references an undeclared local slot "+ins.arg);
  }
  chunk.functions.forEach((fn,i)=>verifyChunk(fn,path+".fn"+i));
  return true;
}

export const verifyBytecode=bytecode=>verifyChunk(bytecode);
