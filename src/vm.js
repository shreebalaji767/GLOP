import { OP } from "./bytecode.js";

export class GlopRuntimeError extends Error {
  constructor(message) {
    super("GLOP RUNTIME OOPSIE: " + message);
    this.name = "GlopRuntimeError";
  }
}

export class GlopCell {
  constructor(value = null) { this.value = value; }
}

export class GlopFunction {
  constructor(chunk, freeCells = []) {
    this.chunk = chunk;
    this.freeCells = freeCells;
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
    this.freeCells = [];
    this.output = output;
  }

  pop() {
    if (!this.stack.length) throw new GlopRuntimeError("stack underflow");
    return this.stack.pop();
  }

  currentConstants() { return this.chunk.constants; }

  captureCell(name) {
    if (this.locals && this.chunk !== this.bc) {
      const localIndex = this.chunk.localNames?.[name];
      if (localIndex !== undefined) return this.locals[localIndex];
    }
    const freeIndex = this.chunk.freeNames?.indexOf(name) ?? -1;
    if (freeIndex >= 0) return this.freeCells[freeIndex];
    throw new GlopRuntimeError("cannot capture lexical name: " + name);
  }

  makeClosure(chunk) {
    const cells = (chunk.freeNames ?? []).map(name => this.captureCell(name));
    return new GlopFunction(chunk, cells);
  }

  run() {
    while (true) {
      if (this.ip >= this.chunk.code.length) throw new GlopRuntimeError("instruction pointer escaped bytecode");
      const ins = this.chunk.code[this.ip++];

      switch (ins.op) {
        case OP.CONST: this.stack.push(this.currentConstants()[ins.arg]); break;

        case OP.LOAD_GLOBAL:
          if (!this.globals.has(ins.arg)) throw new GlopRuntimeError("undefined variable: " + ins.arg);
          this.stack.push(this.globals.get(ins.arg));
          break;

        case OP.STORE_GLOBAL: this.globals.set(ins.arg, this.pop()); break;

        case OP.LOAD_LOCAL: {
          if (!this.locals || ins.arg >= this.locals.length) throw new GlopRuntimeError("invalid local slot: " + ins.arg);
          this.stack.push(this.locals[ins.arg].value);
          break;
        }

        case OP.STORE_LOCAL: {
          if (!this.locals) throw new GlopRuntimeError("local store outside function");
          if (!this.locals[ins.arg]) this.locals[ins.arg] = new GlopCell();
          this.locals[ins.arg].value = this.pop();
          break;
        }

        case OP.LOAD_FREE:
          if (!this.freeCells[ins.arg]) throw new GlopRuntimeError("invalid captured slot: " + ins.arg);
          this.stack.push(this.freeCells[ins.arg].value);
          break;

        case OP.STORE_FREE:
          if (!this.freeCells[ins.arg]) throw new GlopRuntimeError("invalid captured slot: " + ins.arg);
          this.freeCells[ins.arg].value = this.pop();
          break;

        case OP.MAKE_CLOSURE:
          this.stack.push(this.makeClosure(this.chunk.functions[ins.arg]));
          break;

        case OP.MAKE_FUNCTION:
          this.stack.push(this.makeClosure(this.chunk.functions[ins.arg]));
          break;

        case OP.CALL: {
          const argc = ins.arg;
          if (this.stack.length < argc + 1) throw new GlopRuntimeError("stack underflow during call");
          const args = this.stack.splice(this.stack.length - argc, argc);
          const callee = this.pop();
          if (!(callee instanceof GlopFunction)) throw new GlopRuntimeError("attempted to BONK a non-function");
          if (args.length !== callee.chunk.arity) {
            throw new GlopRuntimeError(callee.chunk.name + " expected " + callee.chunk.arity + " argument(s), got " + args.length);
          }

          this.frames.push({
            chunk: this.chunk,
            ip: this.ip,
            locals: this.locals,
            freeCells: this.freeCells
          });

          const localCells = args.map(value => new GlopCell(value));
          this.chunk = callee.chunk;
          this.ip = 0;
          this.locals = localCells;
          this.freeCells = callee.freeCells;
          break;
        }

        case OP.RETURN: {
          const value = this.pop();
          if (!this.frames.length) return value;
          const frame = this.frames.pop();
          this.chunk = frame.chunk;
          this.ip = frame.ip;
          this.locals = frame.locals;
          this.freeCells = frame.freeCells;
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
