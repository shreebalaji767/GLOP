import { OP } from "./bytecode.js";

const jumpOps=new Set([OP.JUMP,OP.JUMP_IF_FALSE,OP.JUMP_IF_TRUE]);
const terminalOps=new Set([OP.RETURN,OP.THROW,OP.HALT]);
const nonNegativeArgs=new Set([
  OP.CONST,OP.MAKE_FUNCTION,OP.MAKE_CLOSURE,OP.LOAD_LOCAL,OP.STORE_LOCAL,
  OP.LOAD_FREE,OP.STORE_FREE,OP.CALL,OP.CALL_METHOD,OP.NEW,OP.MAKE_ARRAY,OP.MAKE_OBJECT,OP.MAKE_CLASS,
]);

export class GlopBytecodeError extends Error {
  constructor(message){super("GLOP BYTECODE OOPSIE: "+message);this.name="GlopBytecodeError";}
}

function fail(path,i,message){
  throw new GlopBytecodeError(path+" instruction "+i+" "+message);
}

function validateShape(chunk,path){
  if(!chunk||!Array.isArray(chunk.code)||!Array.isArray(chunk.constants)||!Array.isArray(chunk.functions))
    throw new GlopBytecodeError(path+" is not a valid bytecode chunk");
  if(!Number.isInteger(chunk.arity)||chunk.arity<0)
    throw new GlopBytecodeError(path+" has an invalid function arity");
  const locals=Object.values(chunk.localNames??{});
  for(const index of locals)
    if(!Number.isInteger(index)||index<0)throw new GlopBytecodeError(path+" has an invalid local slot");
  const freeCount=(chunk.freeNames??[]).length;
  for(let i=0;i<chunk.code.length;i++){
    const ins=chunk.code[i];
    if(!ins||!Object.values(OP).includes(ins.op))fail(path,i,"has an unknown opcode");
    if(ins.arg!=null&&!Number.isInteger(ins.arg)&&typeof ins.arg!=="string")fail(path,i,"has an invalid argument");
    if(nonNegativeArgs.has(ins.op)&&(!Number.isInteger(ins.arg)||ins.arg<0))fail(path,i,"requires a non-negative integer operand");
    if(jumpOps.has(ins.op)&&(!Number.isInteger(ins.arg)||ins.arg<0||ins.arg>=chunk.code.length))fail(path,i,"has an invalid jump target");
    if(ins.op===OP.SETUP_CATCH&&(!Number.isInteger(ins.arg)||ins.arg<0||ins.arg>=chunk.code.length))fail(path,i,"has an invalid catch target");
    if(ins.op===OP.CONST&&ins.arg>=chunk.constants.length)fail(path,i,"references a missing constant");
    if((ins.op===OP.MAKE_FUNCTION||ins.op===OP.MAKE_CLOSURE)&&ins.arg>=chunk.functions.length)fail(path,i,"references a missing function");
    if((ins.op===OP.LOAD_FREE||ins.op===OP.STORE_FREE)&&ins.arg>=(chunk.freeNames??[]).length)fail(path,i,"references a missing free variable");
    if((ins.op===OP.LOAD_LOCAL||ins.op===OP.STORE_LOCAL)&&!locals.includes(ins.arg))fail(path,i,"references an undeclared local slot "+ins.arg);
  }
}

function stackDelta(ins){
  switch(ins.op){
    case OP.CONST:
    case OP.LOAD_GLOBAL:
    case OP.LOAD_LOCAL:
    case OP.LOAD_FREE:
    case OP.MAKE_FUNCTION:
    case OP.MAKE_CLOSURE:
      return 1;
    case OP.STORE_GLOBAL:
    case OP.STORE_LOCAL:
    case OP.STORE_FREE:
    case OP.PRINT:
    case OP.POP:
    case OP.JUMP_IF_FALSE:
    case OP.JUMP_IF_TRUE:
    case OP.NOT:
    case OP.NEG:
    case OP.RETURN:
    case OP.THROW:
    case OP.HALT:
      return -1;
    case OP.MAKE_ARRAY:return 1-ins.arg;
    case OP.MAKE_OBJECT:return 1-(ins.arg*2);
    case OP.GET_INDEX:
    case OP.GET_MEMBER:return -1;
    case OP.SET_INDEX:
    case OP.SET_MEMBER:return -2;
    case OP.CALL:return -ins.arg;
    case OP.CALL_METHOD:return -(ins.arg+1);
    case OP.NEW:return -ins.arg;
    case OP.MAKE_CLASS:return 1-(ins.arg*2);
    case OP.ADD:
    case OP.SUB:
    case OP.MUL:
    case OP.DIV:
    case OP.MOD:
    case OP.EQ:
    case OP.NE:
    case OP.LT:
    case OP.LTE:
    case OP.GT:
    case OP.GTE:
      return -1;
    case OP.JUMP:
    case OP.SETUP_CATCH:
    case OP.POP_CATCH:
      return 0;
    default:throw new GlopBytecodeError("unknown opcode: "+ins.op);
  }
}

function verifyStackFlow(chunk,path){
  if(!chunk.code.length)throw new GlopBytecodeError(path+" has no instructions");
  const incoming=new Map([[0,0]]);
  const queue=[0];
  const catchDepth=new Map();

  for(let i=0;i<chunk.code.length;i++){
    const ins=chunk.code[i];
    if(ins.op===OP.SETUP_CATCH){
      const depth=incoming.get(i);
      if(depth!==undefined){
        const expected=depth+1;
        const old=catchDepth.get(ins.arg);
        if(old!==undefined&&old!==expected)
          throw new GlopBytecodeError(path+" catch target "+ins.arg+" has inconsistent exception stack depth");
        catchDepth.set(ins.arg,expected);
      }
    }
  }

  const enqueue=(target,depth,from)=>{
    if(depth<0)fail(path,from,"would underflow the value stack");
    if(target<0||target>=chunk.code.length)
      fail(path,from,"jumps outside the chunk");
    const old=incoming.get(target);
    if(old===undefined){incoming.set(target,depth);queue.push(target);return;}
    if(old!==depth)
      throw new GlopBytecodeError(path+" instruction "+target+" receives inconsistent stack heights ("+old+" and "+depth+")");
  };

  while(queue.length){
    const i=queue.shift();
    const ins=chunk.code[i];
    const depth=incoming.get(i);
    const delta=stackDelta(ins);
    if(depth+delta<0)fail(path,i,"would underflow the value stack (depth "+depth+", delta "+delta+")");
    const next=depth+delta;
    if(terminalOps.has(ins.op))continue;
    if(ins.op===OP.JUMP){enqueue(ins.arg,next,i);continue;}
    if(ins.op===OP.JUMP_IF_FALSE||ins.op===OP.JUMP_IF_TRUE){
      enqueue(ins.arg,next,i);
      if(i+1<chunk.code.length)enqueue(i+1,next,i);
      continue;
    }
    if(i+1>=chunk.code.length)
      fail(path,i,"falls off the end of the chunk without RETURN or HALT");
    enqueue(i+1,next,i);
  }

  for(const [target,depth] of catchDepth){
    const actual=incoming.get(target);
    if(actual!==undefined&&actual!==depth)
      throw new GlopBytecodeError(path+" catch target "+target+" expects stack height "+depth+" but normal control flow reaches it at "+actual);
  }
  return {maxStack:Math.max(...incoming.values())};
}

export function verifyChunk(chunk,path="<main>"){
  validateShape(chunk,path);
  const flow=verifyStackFlow(chunk,path);
  for(let i=0;i<chunk.functions.length;i++){
    const fn=chunk.functions[i];
    if(!fn||fn.arity==null)throw new GlopBytecodeError(path+".fn"+i+" has invalid function metadata");
    verifyChunk(fn,path+".fn"+i);
  }
  return flow;
}

export const verifyBytecode=bytecode=>verifyChunk(bytecode);
