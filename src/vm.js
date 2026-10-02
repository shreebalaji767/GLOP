import {OP} from "./bytecode.js";

export class GlopRuntimeError extends Error{
 constructor(message){super("GLOP RUNTIME OOPSIE: "+message);this.name="GlopRuntimeError"}
}

export class VM{
 constructor(bytecode,{output=console.log}={}){this.bc=bytecode;this.stack=[];this.globals=new Map();this.ip=0;this.output=output}
 pop(){if(!this.stack.length)throw new GlopRuntimeError("stack underflow");return this.stack.pop()}
 run(){
  const c=this.bc.code,k=this.bc.constants;
  while(this.ip<c.length){
   const ins=c[this.ip++];
   switch(ins.op){
    case OP.CONST:this.stack.push(k[ins.arg]);break;
    case OP.LOAD_GLOBAL:if(!this.globals.has(ins.arg))throw new GlopRuntimeError("undefined variable: "+ins.arg);this.stack.push(this.globals.get(ins.arg));break;
    case OP.STORE_GLOBAL:this.globals.set(ins.arg,this.pop());break;
    case OP.ADD:{const b=this.pop(),a=this.pop();this.stack.push(a+b);break}
    case OP.SUB:{const b=this.pop(),a=this.pop();this.stack.push(a-b);break}
    case OP.MUL:{const b=this.pop(),a=this.pop();this.stack.push(a*b);break}
    case OP.DIV:{const b=this.pop(),a=this.pop();this.stack.push(a/b);break}
    case OP.MOD:{const b=this.pop(),a=this.pop();this.stack.push(a%b);break}
    case OP.EQ:{const b=this.pop(),a=this.pop();this.stack.push(a===b);break}
    case OP.NE:{const b=this.pop(),a=this.pop();this.stack.push(a!==b);break}
    case OP.LT:{const b=this.pop(),a=this.pop();this.stack.push(a<b);break}
    case OP.LTE:{const b=this.pop(),a=this.pop();this.stack.push(a<=b);break}
    case OP.GT:{const b=this.pop(),a=this.pop();this.stack.push(a>b);break}
    case OP.GTE:{const b=this.pop(),a=this.pop();this.stack.push(a>=b);break}
    case OP.NOT:this.stack.push(!this.pop());break;
    case OP.NEG:this.stack.push(-this.pop());break;
    case OP.JUMP:this.ip=ins.arg;break;
    case OP.JUMP_IF_FALSE:{const v=this.pop();if(!v)this.ip=ins.arg;break}
    case OP.PRINT:this.output(this.pop());break;
    case OP.POP:this.pop();break;
    case OP.HALT:return this.pop();
    default:throw new GlopRuntimeError("unknown opcode: "+ins.op);
   }
  }
 }
}
export const runBytecode=(bytecode,options)=>new VM(bytecode,options).run();