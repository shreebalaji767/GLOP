import { OP } from "./bytecode.js";

export class GlopRuntimeError extends Error {
  constructor(message) {
    super("GLOP RUNTIME OOPSIE: " + message);
    this.name = "GlopRuntimeError";
  }
}

export class GlopFunction {
  constructor(chunk) {
    this.chunk = chunk;
  }
}

export class VM {
  constructor(bytecode, { output = console.log } = {}) {
    this.bc = bytecode;
    this.stack = [];
    this.globals = new Map();
    this.frames = [];
    this.ip = 0;
    this.chunk = bytecode;
    this.locals = null;
    this.output = output;
  }

  pop() {
    if (!this.stack.length) throw new GlopRuntimeError("stack underflow");
    return this.stack.pop();
  }

  currentConstants() {
    return this.chunk.constants;
  }

  run() {
    while (true) {
      if (this.ip >= this.chunk.code.length) {
        throw new GlopRuntimeError("instruction pointer escaped bytecode");
      }

      const ins = this.chunk.code[this.ip++];

      switch (ins.op) {
        case OP.CONST:
          this.stack.push(this.currentConstants()[ins.arg]);
          break;

        case OP.LOAD_GLOBAL:
          if (!this.globals.has(ins.arg)) throw new GlopRuntimeError("undefined variable: " + ins.arg);
          this.stack.push(this.globals.get(ins.arg));
          break;

        case OP.STORE_GLOBAL:
          this.globals.set(ins.arg, this.pop());
          break;

        case OP.LOAD_LOCAL:
          if (!this.locals || ins.arg >= this.locals.length) throw new GlopRuntimeError("invalid local slot: " + ins.arg);
          this.stack.push(this.locals[ins.arg]);
          break;

        case OP.STORE_LOCAL: {
          if (!this.locals) throw new GlopRuntimeError("local store outside function");
          this.locals[ins.arg] = this.pop();
          break;
        }

        case OP.MAKE_FUNCTION:
          this.stack.push(new GlopFunction(this.chunk.functions[ins.arg]));
          break;

        case OP.CALL: {
          const argc = ins.arg;
          if (this.stack.length < argc + 1) throw new GlopRuntimeError("stack underflow during call");
          const args = this.stack.splice(this.stack.length - argc, argc);
          const callee = this.pop();

          if (!(callee instanceof GlopFunction)) {
            throw new GlopRuntimeError("attempted to BONK a non-function");
          }
          if (args.length !== callee.chunk.arity) {
            throw new GlopRuntimeError(
              callee.chunk.name + " expected " + callee.chunk.arity + " argument(s), got " + args.length
            );
          }

          this.frames.push({
            chunk: this.chunk,
            ip: this.ip,
            locals: this.locals
          });

          this.chunk = callee.chunk;
          this.ip = 0;
          this.locals = args;
          break;
        }

        case OP.RETURN: {
          const value = this.pop();
          if (!this.frames.length) return value;

          const frame = this.frames.pop();
          this.chunk = frame.chunk;
          this.ip = frame.ip;
          this.locals = frame.locals;
          this.stack.push(value);
          break;
        }

        case OP.ADD: { const b=this.pop(),a=this.pop(); this.stack.push(a+b); break; }
        case OP.SUB: { const b=this.pop(),a=this.pop(); this.stack.push(a-b); break; }
        case OP.MUL: { const b=this.pop(),a=this.pop(); this.stack.push(a*b); break; }
        case OP.DIV: { const b=this.pop(),a=this.pop(); this.stack.push(a/b); break; }
        case OP.MOD: { const b=this.pop(),a=this.pop(); this.stack.push(a%b); break; }
        case OP.EQ: { const b=this.pop(),a=this.pop(); this.stack.push(a===b); break; }
        case OP.NE: { const b=this.pop(),a=this.pop(); this.stack.push(a!==b); break; }
        case OP.LT: { const b=this.pop(),a=this.pop(); this.stack.push(a<b); break; }
        case OP.LTE: { const b=this.pop(),a=this.pop(); this.stack.push(a<=b); break; }
        case OP.GT: { const b=this.pop(),a=this.pop(); this.stack.push(a>b); break; }
        case OP.GTE: { const b=this.pop(),a=this.pop(); this.stack.push(a>=b); break; }
        case OP.NOT: this.stack.push(!this.pop()); break;
        case OP.NEG: this.stack.push(-this.pop()); break;
        case OP.JUMP: this.ip=ins.arg; break;
        case OP.JUMP_IF_FALSE: { const v=this.pop(); if(!v)this.ip=ins.arg; break; }
        case OP.PRINT: this.output(this.pop()); break;
        case OP.POP: this.pop(); break;
        case OP.HALT: return this.pop();
        default: throw new GlopRuntimeError("unknown opcode: " + ins.op);
      }
    }
  }
}

export const runBytecode = (bytecode, options) => new VM(bytecode, options).run();