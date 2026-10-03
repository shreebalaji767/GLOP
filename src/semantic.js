export class GlopSemanticError extends Error {
  constructor(message, code = "SEMANTIC_ERROR") {
    super(message);
    this.name = "GlopSemanticError";
    this.code = code;
  }
}

const TYPE = Object.freeze({
  UNKNOWN:"unknown", NUMBER:"number", STRING:"string", BOOLEAN:"boolean",
  NULL:"null", ARRAY:"array", OBJECT:"object", FUNCTION:"function"
});

class Scope {
  constructor(parent=null, kind="block") { this.parent=parent; this.kind=kind; this.names=new Map(); }
  declare(name,binding){ if(this.names.has(name)) throw new GlopSemanticError(`Duplicate declaration of "${name}" in the same scope`,"DUPLICATE_DECLARATION"); this.names.set(name,binding); }
  resolve(name){ return this.names.has(name) ? this.names.get(name) : this.parent?.resolve(name) ?? null; }
  hasFunctionBoundary(){ for(let s=this;s;s=s.parent) if(s.kind==="function") return true; return false; }
  hasLoopBoundary(){ for(let s=this;s;s=s.parent){ if(s.kind==="loop") return true; if(s.kind==="function") return false; } return false; }
}

export class SemanticAnalyzer {
  constructor(){ this.global=new Scope(null,"global"); this.functionTypes=new Map(); this.declareBuiltins(); }
  declareBuiltins(){
    const names=["LEN","PUSH","POP","TYPE","TO_STRING","ABS","SQRT","FLOOR","CEIL","SUBSTR","UPPER","LOWER","HAS","KEYS","RANGE","NUMBER","MIN","MAX","POW","CLAMP","ASSERT","REPEAT","TRIM","REPLACE","SPLIT","JOIN","READ_FILE","WRITE_FILE","EXISTS","CWD","JOIN_PATH","ENV","ARGS","TIME_MS","SLEEP_MS","ROUND","RANDOM","JSON_PARSE","JSON_STRINGIFY","IS_NAN","IS_FINITE"];
    for(const name of names)this.global.declare(name,{kind:"builtin",type:TYPE.FUNCTION,arity:null,returnType:TYPE.UNKNOWN});
  }
  analyze(program){
    this.predeclareFunctions(program.body,this.global);
    for(const s of program.body) if(s.type==="ImportDecl"){ if(this.global.names.has(s.alias)) throw new GlopSemanticError(`Duplicate declaration of "${s.alias}" in the same scope`,"DUPLICATE_DECLARATION"); this.global.declare(s.alias,{kind:"module",type:TYPE.OBJECT}); }
    for(const s of program.body)this.statement(s,this.global);
    return program;
  }
  predeclareFunctions(statements,scope){
    for(const s of statements) if(s.type==="FunctionDecl")
      scope.declare(s.name,{kind:"function",arity:s.params.length,returnType:TYPE.UNKNOWN});
  }
  block(statements,parent,kind="block"){
    const scope=new Scope(parent,kind); this.predeclareFunctions(statements,scope);
    for(const s of statements)this.statement(s,scope); return scope;
  }
  statement(n,scope){
    try { switch(n.type){
      case "ImportDecl": if(scope!==this.global) throw new GlopSemanticError("STEAL is only allowed at module scope","IMPORT_SCOPE"); return;
      case "ExportDecl": if(scope!==this.global) throw new GlopSemanticError("FLEX is only allowed at module scope","EXPORT_SCOPE"); for(const name of n.names) if(!scope.resolve(name)) throw new GlopSemanticError(`Cannot FLEX undefined name "${name}"`,"EXPORT_UNDEFINED"); return;
      case "VarDecl": { const type=this.expression(n.value,scope); scope.declare(n.name,{kind:"variable",type}); return; }
      case "FunctionDecl": {
        const fn=new Scope(scope,"function");
        for(const p of n.params) fn.declare(p,{kind:"parameter",type:TYPE.UNKNOWN});
        this.predeclareFunctions(n.body,fn);
        for(const s of n.body)this.statement(s,fn);
        return;
      }
      case "Print": case "ExpressionStatement": this.expression(n.expression,scope); return;
      case "Assignment": this.assignment(n,scope); return;
      case "If":
        this.requireBoolean(this.expression(n.test,scope),"SUS condition"); this.block(n.consequent,scope);
        if(n.alternate)this.block(n.alternate,scope); return;
      case "While":
        this.requireBoolean(this.expression(n.test,scope),"SPIN condition"); this.block(n.body,scope,"loop"); return;
      case "Return":
        if(!scope.hasFunctionBoundary()) throw new GlopSemanticError("YEET can only be used inside a WIZARD","RETURN_OUTSIDE_FUNCTION");
        this.expression(n.value,scope); return;
      case "Break":
        if(!scope.hasLoopBoundary()) throw new GlopSemanticError("NOPE can only be used inside a SPIN loop","BREAK_OUTSIDE_LOOP"); return;
      case "Continue":
        if(!scope.hasLoopBoundary()) throw new GlopSemanticError("ZOOM can only be used inside a SPIN loop","CONTINUE_OUTSIDE_LOOP"); return;
      case "Throw": this.expression(n.value,scope); return;
      case "TryCatch": {
        this.block(n.tryBody,scope);
        const cs=new Scope(scope,"block"); cs.declare(n.param,{kind:"catch_parameter",type:TYPE.UNKNOWN});
        this.predeclareFunctions(n.catchBody,cs); for(const s of n.catchBody)this.statement(s,cs); return;
      }
      default: throw new GlopSemanticError(`Unknown statement node "${n.type}"`,"UNKNOWN_AST_NODE");
    } } catch(e) {
      if(e instanceof GlopSemanticError && !e.line && n.loc){e.line=n.loc.line;e.column=n.loc.column;}
      throw e;
    }
  }
  requireBoolean(type,where){ if(type!==TYPE.UNKNOWN&&type!==TYPE.BOOLEAN) throw new GlopSemanticError(`${where} requires a boolean expression, got ${type}`,"TYPE_ERROR"); }
  assignment(n,scope){
    const rhs=this.expression(n.value,scope);
    if(n.target.type==="Identifier"){
      const b=scope.resolve(n.target.name); if(!b) throw new GlopSemanticError(`Cannot assign to undeclared name "${n.target.name}"`,"UNDEFINED_NAME");
      if(n.op==="=") this.ensureAssignable(b.type??TYPE.UNKNOWN,rhs,n.target.name);
      else { this.requireNumericLike(b.type,n.op); this.requireNumericLike(rhs,n.op); }
      return;
    }
    if(n.target.type==="Member"||n.target.type==="Index"){ this.expression(n.target,scope); return; }
    throw new GlopSemanticError("Invalid assignment target","INVALID_ASSIGNMENT_TARGET");
  }
  ensureAssignable(expected,actual,name){ if(expected!==TYPE.UNKNOWN&&actual!==TYPE.UNKNOWN&&expected!==actual) throw new GlopSemanticError(`Cannot assign ${actual} to ${name} (declared as ${expected})`,"TYPE_ERROR"); }
  requireNumericLike(type,op){ if(type!==TYPE.UNKNOWN&&type!==TYPE.NUMBER) throw new GlopSemanticError(`Operator ${op} requires a number, got ${type}`,"TYPE_ERROR"); }
  expression(n,scope){
    try { switch(n.type){
      case "Literal": return n.value===null?TYPE.NULL:typeof n.value;
      case "Identifier": { const b=scope.resolve(n.name); if(!b) throw new GlopSemanticError(`Undefined name "${n.name}"`,"UNDEFINED_NAME"); return b.type??(b.kind==="function"?TYPE.FUNCTION:TYPE.UNKNOWN); }
      case "Unary": { const t=this.expression(n.argument,scope); if(n.op==="-" )this.requireNumericLike(t,n.op); return n.op==="!"?TYPE.BOOLEAN:TYPE.NUMBER; }
      case "Binary": {
        const a=this.expression(n.left,scope),b=this.expression(n.right,scope);
        if(["-","*","/","%"].includes(n.op)){this.requireNumericLike(a,n.op);this.requireNumericLike(b,n.op);return TYPE.NUMBER;}
        if(["<","<=",">",">="].includes(n.op)){if(a!==TYPE.UNKNOWN&&b!==TYPE.UNKNOWN&&a!==b)throw new GlopSemanticError(`Cannot compare ${a} with ${b}`,"TYPE_ERROR");return TYPE.BOOLEAN;}
        if(n.op==="+"){if(a===TYPE.STRING&&b===TYPE.STRING)return TYPE.STRING;if(a===TYPE.NUMBER&&b===TYPE.NUMBER)return TYPE.NUMBER;if(a!==TYPE.UNKNOWN&&b!==TYPE.UNKNOWN)throw new GlopSemanticError(`Cannot add ${a} and ${b}`,"TYPE_ERROR");return TYPE.UNKNOWN;}
        if(["==","!="].includes(n.op))return TYPE.BOOLEAN;
        this.requireBoolean(a,n.op);this.requireBoolean(b,n.op);return TYPE.BOOLEAN;
      }
      case "Call": {
        const b=n.callee.type==="Identifier"?scope.resolve(n.callee.name):null;
        const ct=this.expression(n.callee,scope); if(ct!==TYPE.UNKNOWN&&ct!==TYPE.FUNCTION) throw new GlopSemanticError(`Cannot BONK a ${ct}`,"TYPE_ERROR");
        for(const a of n.args)this.expression(a,scope);
        if((b?.kind==="function"||b?.kind==="builtin")&&b.arity!==null&&n.args.length!==b.arity) throw new GlopSemanticError(`${n.callee.name} expects ${b.arity} argument(s), got ${n.args.length}`,"ARITY_ERROR");
        return b?.returnType??TYPE.UNKNOWN;
      }
      case "Array": for(const e of n.elements)this.expression(e,scope); return TYPE.ARRAY;
      case "Object": for(const p of n.properties)this.expression(p.value,scope); return TYPE.OBJECT;
      case "Member": this.expression(n.object,scope); return TYPE.UNKNOWN;
      case "Index": this.expression(n.object,scope); this.expression(n.index,scope); return TYPE.UNKNOWN;
      default: throw new GlopSemanticError(`Unknown expression node "${n.type}"`,"UNKNOWN_AST_NODE");
    } } catch(e) {
      if(e instanceof GlopSemanticError && !e.line && n.loc){e.line=n.loc.line;e.column=n.loc.column;}
      throw e;
    }
  }
}
export const analyze=program=>new SemanticAnalyzer().analyze(program);
