export class GlopSemanticError extends Error {
  constructor(message, code = "SEMANTIC_ERROR") {
    super(message);
    this.name = "GlopSemanticError";
    this.code = code;
  }
}

class Scope {
  constructor(parent = null, kind = "block") {
    this.parent = parent;
    this.kind = kind;
    this.names = new Map();
  }

  declare(name, kind) {
    if (this.names.has(name)) {
      throw new GlopSemanticError(
        `Duplicate declaration of "${name}" in the same scope`,
        "DUPLICATE_DECLARATION"
      );
    }
    this.names.set(name, kind);
  }

  hasLocal(name) {
    return this.names.has(name);
  }

  resolve(name) {
    if (this.names.has(name)) return this.names.get(name);
    return this.parent?.resolve(name) ?? null;
  }

  hasFunctionBoundary() {
    for (let s = this; s; s = s.parent) {
      if (s.kind === "function") return true;
    }
    return false;
  }

  hasLoopBoundary() {
    for (let s = this; s; s = s.parent) {
      if (s.kind === "loop") return true;
      if (s.kind === "function") return false;
    }
    return false;
  }
}

export class SemanticAnalyzer {
  constructor() {
    this.global = new Scope(null, "global");
    this.functions = new Map();
  }

  analyze(program) {
    this.predeclareFunctions(program.body, this.global);
    for (const statement of program.body) this.statement(statement, this.global);
    return program;
  }

  predeclareFunctions(statements, scope) {
    for (const statement of statements) {
      if (statement.type === "FunctionDecl") {
        scope.declare(statement.name, "function");
      }
    }
  }

  block(statements, parent, kind = "block") {
    const scope = new Scope(parent, kind);
    this.predeclareFunctions(statements, scope);
    for (const statement of statements) this.statement(statement, scope);
    return scope;
  }

  statement(n, scope) {
    switch (n.type) {
      case "VarDecl":
        this.expression(n.value, scope);
        scope.declare(n.name, "variable");
        return;

      case "FunctionDecl": {
        const fn = new Scope(scope, "function");
        for (const param of n.params) fn.declare(param, "parameter");
        this.predeclareFunctions(n.body, fn);
        for (const statement of n.body) this.statement(statement, fn);
        return;
      }

      case "Print":
      case "ExpressionStatement":
        this.expression(n.expression, scope);
        return;

      case "Assignment":
        this.assignment(n, scope);
        return;

      case "If":
        this.expression(n.test, scope);
        this.block(n.consequent, scope);
        if (n.alternate) this.block(n.alternate, scope);
        return;

      case "While":
        this.expression(n.test, scope);
        this.block(n.body, scope, "loop");
        return;

      case "Return":
        if (!scope.hasFunctionBoundary()) {
          throw new GlopSemanticError("YEET can only be used inside a WIZARD", "RETURN_OUTSIDE_FUNCTION");
        }
        this.expression(n.value, scope);
        return;

      case "Break":
        if (!scope.hasLoopBoundary()) {
          throw new GlopSemanticError("NOPE can only be used inside a SPIN loop", "BREAK_OUTSIDE_LOOP");
        }
        return;

      case "Continue":
        if (!scope.hasLoopBoundary()) {
          throw new GlopSemanticError("ZOOM can only be used inside a SPIN loop", "CONTINUE_OUTSIDE_LOOP");
        }
        return;

      case "Throw":
        this.expression(n.value, scope);
        return;

      case "TryCatch": {
        this.block(n.tryBody, scope);
        const catchScope = new Scope(scope, "block");
        catchScope.declare(n.param, "catch_parameter");
        this.predeclareFunctions(n.catchBody, catchScope);
        for (const statement of n.catchBody) this.statement(statement, catchScope);
        return;
      }

      default:
        throw new GlopSemanticError(`Unknown statement node "${n.type}"`, "UNKNOWN_AST_NODE");
    }
  }

  assignment(n, scope) {
    this.expression(n.value, scope);
    if (n.target.type === "Identifier") {
      if (!scope.resolve(n.target.name)) {
        throw new GlopSemanticError(
          `Cannot assign to undeclared name "${n.target.name}"`,
          "UNDEFINED_NAME"
        );
      }
      return;
    }
    if (n.target.type === "Member" || n.target.type === "Index") {
      this.expression(n.target, scope);
      return;
    }
    throw new GlopSemanticError("Invalid assignment target", "INVALID_ASSIGNMENT_TARGET");
  }

  expression(n, scope) {
    switch (n.type) {
      case "Literal":
        return;

      case "Identifier":
        if (!scope.resolve(n.name)) {
          throw new GlopSemanticError(`Undefined name "${n.name}"`, "UNDEFINED_NAME");
        }
        return;

      case "Unary":
        this.expression(n.argument, scope);
        return;

      case "Binary":
        this.expression(n.left, scope);
        this.expression(n.right, scope);
        return;

      case "Call":
        this.expression(n.callee, scope);
        for (const arg of n.args) this.expression(arg, scope);
        return;

      case "Array":
        for (const element of n.elements) this.expression(element, scope);
        return;

      case "Object":
        for (const property of n.properties) this.expression(property.value, scope);
        return;

      case "Member":
        this.expression(n.object, scope);
        return;

      case "Index":
        this.expression(n.object, scope);
        this.expression(n.index, scope);
        return;

      default:
        throw new GlopSemanticError(`Unknown expression node "${n.type}"`, "UNKNOWN_AST_NODE");
    }
  }
}

export const analyze = program => new SemanticAnalyzer().analyze(program);
