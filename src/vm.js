import { OP } from "./bytecode.js";
import { GLOP_STDLIB } from "./stdlib.js";

export class GlopRuntimeError extends Error { constructor(message){super("GLOP RUNTIME OOPSIE: "+message);this.name="GlopRuntimeError"} }
export class GlopCell { constructor(value=null){this.value=value} }
export class GlopFunction { constructor(chunk,freeCells=[],globals=null){this.chunk=chunk;this.freeCells=freeCells;this.globals=globals} }
export class GlopClass { constructor(name,methods={},parent=null){this.name=name;this.methods=methods;this.parent=parent} getMethod(name){return this.methods[name]??this.parent?.getMethod(name)} }
const glopInstance=(klass)=>{const o=Object.create(null);Object.defineProperty(o,"__glopClass",{value:klass,enumerable:false});for(let k=klass;k;k=k.parent)for(const [name,v] of Object.entries(k.methods))if(name!=="INIT"&&o[name]===undefined)o[name]=v;return o};

export class VM {
  constructor(bytecode,{output=console.log,globals=null,trace=false,traceOutput=console.error,breakpoints=[],debugOutput=console.error,debugInput=false}={}){this.bc=bytecode;this.stack=[];this.trace=trace;this.traceOutput=traceOutput;this.breakpoints=new Set(breakpoints);this.debugOutput=debugOutput;this.debugStep=false;this.paused=false;this.stepMode=false;this.globals=globals??new Map(Object.entries(GLOP_STDLIB).map(([name,fn])=>[name,fn]));this.frames=[];this.handlers=[];this.ip=0;this.chunk=bytecode;this.locals=null;this.freeCells=[];this.output=output}
  pop(){if(!this.stack.length)throw new GlopRuntimeError("stack underflow");return this.stack.pop()}
  currentConstants(){return this.chunk.constants}
  captureCell(name){if(this.locals&&this.chunk!==this.bc){const i=this.chunk.localNames?.[name];if(i!==undefined)return this.locals[i]}const fi=this.chunk.freeNames?.indexOf(name)??-1;if(fi>=0)return this.freeCells[fi];throw new GlopRuntimeError("cannot capture lexical name: "+name)}
  makeClosure(chunk){return new GlopFunction(chunk,(chunk.freeNames??[]).map(name=>this.captureCell(name)),this.globals)}
  raise(error){
    while(this.handlers.length){
      const h=this.handlers.pop();
      while(this.frames.length>h.frameDepth)this.frames.pop();
      this.chunk=h.chunk;this.ip=h.target;this.locals=h.locals;this.freeCells=h.freeCells;this.globals=h.globals;
      this.stack.length=h.stackDepth;this.stack.push(error);
      return;
    }
    if(error instanceof Error)throw error;
    throw new GlopRuntimeError(String(error));
  }
  run(){
    while(true){
      if(this.ip>=this.chunk.code.length)throw new GlopRuntimeError("instruction pointer escaped bytecode");
      const offset=this.ip;const ins=this.chunk.code[this.ip++];const line=ins.loc?.line??0;const column=ins.loc?.column??0;if(this.breakpoints.has(line)||this.debugStep||this.stepMode){this.debugOutput("[GLOP DEBUG] "+(this.chunk.name||"<main>")+" "+line+":"+column+" @"+offset+" "+ins.op);if(this.locals){const vars=Object.entries(this.chunk.localNames||{}).sort((a,b)=>Number(a[1])-Number(b[1])).map(([name,i])=>name+"="+JSON.stringify(this.locals[i]?.value));if(vars.length)this.debugOutput("  locals: "+vars.join(", "));}if(this.frames.length)this.debugOutput("  call stack: "+this.frames.map(f=>f.chunk.name||"<main>").concat(this.chunk.name||"<main>").join(" -> "));this.stepMode=false;}if(this.trace){const p=ins.loc?` ${ins.loc.line}:${ins.loc.column}`:"";this.traceOutput(`[GLOP TRACE] ${this.chunk.name||"<main>"}${p} @${offset} ${ins.op}${ins.arg===null||ins.arg===undefined?"":" "+ins.arg} | stack=${this.stack.length}`);}
      switch(ins.op){
        case OP.CONST:this.stack.push(this.currentConstants()[ins.arg]);break;
        case OP.LOAD_GLOBAL:if(!this.globals.has(ins.arg))throw new GlopRuntimeError("undefined variable: "+ins.arg);this.stack.push(this.globals.get(ins.arg));break;
        case OP.STORE_GLOBAL:this.globals.set(ins.arg,this.pop());break;
        case OP.LOAD_LOCAL:if(!this.locals||ins.arg>=this.locals.length)throw new GlopRuntimeError("invalid local slot: "+ins.arg);this.stack.push(this.locals[ins.arg].value);break;
        case OP.STORE_LOCAL:if(!this.locals)throw new GlopRuntimeError("local store outside function");if(!this.locals[ins.arg])this.locals[ins.arg]=new GlopCell();this.locals[ins.arg].value=this.pop();break;
        case OP.LOAD_FREE:if(!this.freeCells[ins.arg])throw new GlopRuntimeError("invalid captured slot: "+ins.arg);this.stack.push(this.freeCells[ins.arg].value);break;
        case OP.STORE_FREE:if(!this.freeCells[ins.arg])throw new GlopRuntimeError("invalid captured slot: "+ins.arg);this.freeCells[ins.arg].value=this.pop();break;
        case OP.MAKE_CLOSURE:case OP.MAKE_FUNCTION:this.stack.push(this.makeClosure(this.chunk.functions[ins.arg]));break;
        case OP.SETUP_CATCH:this.handlers.push({frameDepth:this.frames.length,chunk:this.chunk,target:ins.arg,locals:this.locals,freeCells:this.freeCells,globals:this.globals,stackDepth:this.stack.length});break;
        case OP.POP_CATCH:{const i=this.handlers.length-1;if(i<0)throw new GlopRuntimeError("catch handler stack underflow");this.handlers.splice(i,1);break;}
        case OP.THROW:{const error=this.pop();this.raise(error);break;}
        case OP.MAKE_ARRAY:{const count=ins.arg;if(this.stack.length<count)throw new GlopRuntimeError("stack underflow during array creation");this.stack.push(this.stack.splice(this.stack.length-count,count));break}
        case OP.MAKE_CLASS:{const count=ins.arg;if(this.stack.length<count*2+1)throw new GlopRuntimeError("stack underflow during class creation");const values=this.stack.splice(this.stack.length-count*2,count*2);const parent=this.pop();if(parent!==null&&!(parent instanceof GlopClass))throw new GlopRuntimeError("EXTENDS expects a CLASS");const methods={};for(let i=0;i<count*2;i+=2)methods[values[i]]=values[i+1];this.stack.push(new GlopClass("GLOP_CLASS",methods,parent));break}
        case OP.MAKE_OBJECT:{const count=ins.arg;if(this.stack.length<count*2)throw new GlopRuntimeError("stack underflow during object creation");const values=this.stack.splice(this.stack.length-count*2,count*2);const obj={};for(let i=0;i<count*2;i+=2)obj[values[i]]=values[i+1];this.stack.push(obj);break}
        case OP.GET_INDEX:{const index=this.pop(),object=this.pop();if(object==null)throw new GlopRuntimeError("cannot index "+object);try{this.stack.push(object[index])}catch{throw new GlopRuntimeError("invalid index operation")}break}
        case OP.SET_INDEX:{const value=this.pop(),index=this.pop(),object=this.pop();if(object==null)throw new GlopRuntimeError("cannot index "+object);try{object[index]=value;this.stack.push(value)}catch{throw new GlopRuntimeError("invalid index assignment")}break}
        case OP.GET_MEMBER:{const key=this.pop(),object=this.pop();if(object==null)throw new GlopRuntimeError("cannot access member of "+object);this.stack.push(object[key]);break}
        case OP.SET_MEMBER:{const value=this.pop(),key=this.pop(),object=this.pop();if(object==null)throw new GlopRuntimeError("cannot set member of "+object);object[key]=value;this.stack.push(value);break}
        case OP.NEW:{const argc=ins.arg;if(this.stack.length<argc+1)throw new GlopRuntimeError("stack underflow during NEW");const args=this.stack.splice(this.stack.length-argc,argc);const klass=this.pop();if(!(klass instanceof GlopClass))throw new GlopRuntimeError("NEW expects a CLASS");const instance=glopInstance(klass);const init=klass.getMethod("INIT");if(init===undefined){if(args.length)throw new GlopRuntimeError("class has no INIT constructor");this.stack.push(instance);break;}if(!(init instanceof GlopFunction))throw new GlopRuntimeError("INIT is not a WIZARD");if(args.length!==init.chunk.arity)throw new GlopRuntimeError("INIT expected "+init.chunk.arity+" argument(s), got "+args.length);this.frames.push({chunk:this.chunk,ip:this.ip,locals:this.locals,freeCells:this.freeCells,globals:this.globals,newInstance:instance});this.chunk=init.chunk;this.ip=0;this.locals=[new GlopCell(instance),...args.map(value=>new GlopCell(value))];this.freeCells=init.freeCells;this.globals=init.globals??this.globals;break}
        case OP.CALL:{
          const argc=ins.arg;if(this.stack.length<argc+1)throw new GlopRuntimeError("stack underflow during call");
          const args=this.stack.splice(this.stack.length-argc,argc);const callee=this.pop();
          if(typeof callee==="function"){try{this.stack.push(callee(args));}catch(e){this.raise(e);}break;}
          if(!(callee instanceof GlopFunction))throw new GlopRuntimeError("attempted to BONK a non-function");
          if(args.length!==callee.chunk.arity)throw new GlopRuntimeError(callee.chunk.name+" expected "+callee.chunk.arity+" argument(s), got "+args.length);
          this.frames.push({chunk:this.chunk,ip:this.ip,locals:this.locals,freeCells:this.freeCells,globals:this.globals});
          this.chunk=callee.chunk;this.ip=0;this.locals=args.map(value=>new GlopCell(value));this.freeCells=callee.freeCells;this.globals=callee.globals??this.globals;break;
        }
        case OP.CALL_METHOD:{
          const argc=ins.arg;if(this.stack.length<argc+2)throw new GlopRuntimeError("stack underflow during method call");
          const args=this.stack.splice(this.stack.length-argc,argc);const key=this.pop();const receiver=this.pop();
          if(receiver==null)throw new GlopRuntimeError("cannot BONK a method on "+receiver);
          let callee;try{callee=receiver[key]??receiver.__glopClass?.getMethod(key);}catch{throw new GlopRuntimeError("cannot access method "+String(key));}
          if(typeof callee==="function"){try{this.stack.push(callee.call(receiver,args));}catch(e){this.raise(e);}break;}
          if(!(callee instanceof GlopFunction))throw new GlopRuntimeError("attempted to BONK a non-function member");
          if(args.length!==callee.chunk.arity)throw new GlopRuntimeError(callee.chunk.name+" expected "+callee.chunk.arity+" argument(s), got "+args.length);
          this.frames.push({chunk:this.chunk,ip:this.ip,locals:this.locals,freeCells:this.freeCells,globals:this.globals});
          this.chunk=callee.chunk;this.ip=0;this.locals=[new GlopCell(receiver),...args.map(value=>new GlopCell(value))];this.freeCells=callee.freeCells;this.globals=callee.globals??this.globals;break;
        }
        case OP.RETURN:{const value=this.pop();if(!this.frames.length)return value;const frame=this.frames.pop();this.handlers=this.handlers.filter(h=>h.frameDepth<this.frames.length+1);this.chunk=frame.chunk;this.ip=frame.ip;this.locals=frame.locals;this.freeCells=frame.freeCells;this.globals=frame.globals;this.stack.push(value);break}
        case OP.ADD:{const b=this.pop(),a=this.pop();this.stack.push(a+b);break} case OP.SUB:{const b=this.pop(),a=this.pop();this.stack.push(a-b);break} case OP.MUL:{const b=this.pop(),a=this.pop();this.stack.push(a*b);break} case OP.DIV:{const b=this.pop(),a=this.pop();this.stack.push(a/b);break} case OP.MOD:{const b=this.pop(),a=this.pop();this.stack.push(a%b);break}
        case OP.EQ:{const b=this.pop(),a=this.pop();this.stack.push(a===b);break} case OP.NE:{const b=this.pop(),a=this.pop();this.stack.push(a!==b);break} case OP.LT:{const b=this.pop(),a=this.pop();this.stack.push(a<b);break} case OP.LTE:{const b=this.pop(),a=this.pop();this.stack.push(a<=b);break} case OP.GT:{const b=this.pop(),a=this.pop();this.stack.push(a>b);break} case OP.GTE:{const b=this.pop(),a=this.pop();this.stack.push(a>=b);break}
        case OP.JUMP_IF_TRUE:{const v=this.pop();if(v)this.ip=ins.arg;break}
        case OP.NOT:this.stack.push(!this.pop());break;case OP.NEG:this.stack.push(-this.pop());break;case OP.JUMP:this.ip=ins.arg;break;case OP.JUMP_IF_FALSE:{const v=this.pop();if(!v)this.ip=ins.arg;break}
        case OP.PRINT:this.output(this.pop());break;case OP.POP:this.pop();break;case OP.HALT:return this.pop();
        default:throw new GlopRuntimeError("unknown opcode: "+ins.op);
      }
    }
  }
}
export const runBytecode=(bytecode,options)=>new VM(bytecode,options).run();

export const debugBytecode=(bytecode,options={})=>new VM(bytecode,{...options,trace:false}).run();
