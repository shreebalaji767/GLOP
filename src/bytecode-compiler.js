import { BytecodeBuilder, OP } from "./bytecode.js";

export class BytecodeCompiler {
  constructor() {
    this.b = new BytecodeBuilder();
    this.locals = null;
    this.contexts = [];
    this.loopContexts = [];
  }

  compile(program) {
    for (const s of program.body) if (s.type === "FunctionDecl") this.defineFunction(s);
    for (const s of program.body) if (s.type !== "FunctionDecl") this.statement(s);
    this.b.emit(OP.CONST, this.b.constant(null));
    this.b.emit(OP.HALT);
    return this.b;
  }

  compileFunction(n) {
    const previous = this.b;
    const previousLocals = this.locals;
    const previousLoops = this.loopContexts;
    this.b = new BytecodeBuilder();
    this.locals = new Map(n.params.map((name, i) => [name, i]));
    for (const s of n.body) if (s.type === "FunctionDecl" && !this.locals.has(s.name)) this.locals.set(s.name, this.locals.size);
    this.loopContexts = [];
    const context = { locals: this.locals, freeNames: [], freeMap: new Map() };
    this.contexts.push(context);

    for (const s of n.body) this.statement(s);
    this.b.emit(OP.CONST, this.b.constant(null));
    this.b.emit(OP.RETURN);

    const chunk = {
      code: this.b.code,
      constants: this.b.constants,
      functions: this.b.functions,
      arity: n.params.length,
      name: n.name,
      freeNames: context.freeNames,
      localNames: Object.fromEntries(context.locals)
    };

    this.contexts.pop();
    this.b = previous;
    this.locals = previousLocals;
    this.loopContexts = previousLoops;
    return chunk;
  }

  defineFunction(n) {
    const chunk = this.compileFunction(n);
    const index = this.b.addFunction(chunk);
    this.b.emit(OP.MAKE_CLOSURE, index);
    if (this.locals) this.b.emit(OP.STORE_LOCAL, this.locals.get(n.name));
    else this.b.emit(OP.STORE_GLOBAL, n.name);
  }

  currentContext() { return this.contexts[this.contexts.length - 1] ?? null; }

  ensureFree(context, name) {
    if (!context.freeMap.has(name)) {
      const index = context.freeNames.length;
      context.freeNames.push(name);
      context.freeMap.set(name, index);
    }
    return context.freeMap.get(name);
  }

  resolveName(name) {
    const current = this.currentContext();
    if (!current) return { kind: "global", name };
    if (current.locals.has(name)) return { kind: "local", index: current.locals.get(name) };
    if (current.freeMap.has(name)) return { kind: "free", index: current.freeMap.get(name) };

    for (let i = this.contexts.length - 2; i >= 0; i--) {
      const parent = this.contexts[i];
      if (parent.locals.has(name) || parent.freeMap.has(name)) {
        for (let j = i + 1; j < this.contexts.length; j++) this.ensureFree(this.contexts[j], name);
        return { kind: "free", index: current.freeMap.get(name) };
      }
    }
    return { kind: "global", name };
  }

  statement(n) {
    switch (n.type) {
      case "VarDecl":
        this.expr(n.value);
        if (this.locals) {
          const index = this.locals.size;
          this.locals.set(n.name, index);
          this.b.emit(OP.STORE_LOCAL, index);
        } else this.b.emit(OP.STORE_GLOBAL, n.name);
        break;

      case "FunctionDecl": this.defineFunction(n); break;
      case "Print": this.expr(n.expression); this.b.emit(OP.PRINT); break;
      case "ExpressionStatement": this.expr(n.expression); this.b.emit(OP.POP); break;
      case "Return": this.expr(n.value); this.b.emit(OP.RETURN); break;

      case "Assignment": {
        if (n.target.type !== "Identifier") throw new Error("Bytecode backend only supports identifier assignment");
        const target = this.resolveName(n.target.name);
        if (n.op !== "=") {
          this.loadName(target);
          this.expr(n.value);
          const op = { "+=":OP.ADD, "-=":OP.SUB, "*=":OP.MUL, "/=":OP.DIV }[n.op];
          if (!op) throw new Error("Unsupported assignment operator: " + n.op);
          this.b.emit(op);
        } else this.expr(n.value);
        this.storeName(target);
        break;
      }

      case "While": {
        const start = this.b.code.length;
        this.expr(n.test);
        const exit = this.b.emit(OP.JUMP_IF_FALSE, null);
        this.loopContexts.push({ breakJumps: [], continueTarget: start });
        for (const s of n.body) this.statement(s);
        this.b.emit(OP.JUMP, start);
        const end = this.b.code.length;
        this.b.patch(exit, end);
        const loop = this.loopContexts.pop();
        for (const jump of loop.breakJumps) this.b.patch(jump, end);
        break;
      }

      case "Break": {
        if (!this.loopContexts.length) throw new Error("NOPE outside SPIN");
        this.loopContexts[this.loopContexts.length - 1].breakJumps.push(this.b.emit(OP.JUMP, null));
        break;
      }

      case "Continue": {
        if (!this.loopContexts.length) throw new Error("ZOOM outside SPIN");
        this.b.emit(OP.JUMP, this.loopContexts[this.loopContexts.length - 1].continueTarget);
        break;
      }

      case "If": {
        this.expr(n.test);
        const j = this.b.emit(OP.JUMP_IF_FALSE, null);
        for (const s of n.consequent) this.statement(s);
        if (n.alternate) {
          const j2 = this.b.emit(OP.JUMP, null);
          this.b.patch(j, this.b.code.length);
          for (const s of n.alternate) this.statement(s);
          this.b.patch(j2, this.b.code.length);
        } else this.b.patch(j, this.b.code.length);
        break;
      }

      default: throw new Error("Bytecode backend does not yet support " + n.type);
    }
  }

  loadName(ref) {
    if (ref.kind === "local") this.b.emit(OP.LOAD_LOCAL, ref.index);
    else if (ref.kind === "free") this.b.emit(OP.LOAD_FREE, ref.index);
    else this.b.emit(OP.LOAD_GLOBAL, ref.name);
  }

  storeName(ref) {
    if (ref.kind === "local") this.b.emit(OP.STORE_LOCAL, ref.index);
    else if (ref.kind === "free") this.b.emit(OP.STORE_FREE, ref.index);
    else this.b.emit(OP.STORE_GLOBAL, ref.name);
  }

  expr(n) {
    switch (n.type) {
      case "Literal": this.b.emit(OP.CONST, this.b.constant(n.value)); break;
      case "Identifier": this.loadName(this.resolveName(n.name)); break;
      case "Unary": this.expr(n.argument); this.b.emit(n.op === "!" ? OP.NOT : OP.NEG); break;
      case "Binary": {
        this.expr(n.left); this.expr(n.right);
        const op = { "+":OP.ADD, "-":OP.SUB, "*":OP.MUL, "/":OP.DIV, "%":OP.MOD, "==":OP.EQ, "!=":OP.NE, "<":OP.LT, "<=":OP.LTE, ">":OP.GT, ">=":OP.GTE }[n.op];
        if (!op) throw new Error("Unsupported binary operator: " + n.op);
        this.b.emit(op);
        break;
      }
      case "Call":
        this.expr(n.callee);
        for (const arg of n.args) this.expr(arg);
        this.b.emit(OP.CALL, n.args.length);
        break;
      default: throw new Error("Bytecode backend does not yet support " + n.type);
    }
  }
}

export const compileBytecode = ast => new BytecodeCompiler().compile(ast);
