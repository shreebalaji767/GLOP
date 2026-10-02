import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { compileBytecode } from "./bytecode-compiler.js";
import { VM } from "./vm.js";

export class GlopModuleError extends Error {
  constructor(message,code="MODULE_ERROR"){super(`GLOP MODULE OOPSIE: ${message}`);this.name="GlopModuleError";this.code=code}
}

export class ModuleLoader {
  constructor({output=console.log}={}){this.output=output;this.cache=new Map();this.loading=[]}
  resolve(specifier,fromFile){
    if(!specifier||typeof specifier!=="string")throw new GlopModuleError("empty module path","MODULE_PATH");
    if(!specifier.startsWith("./")&&!specifier.startsWith("../")&&!path.isAbsolute(specifier))
      throw new GlopModuleError(`only relative module paths are supported: ${specifier}`,"MODULE_PATH");
    let resolved=path.resolve(path.dirname(fromFile),specifier);
    if(!path.extname(resolved))resolved+=".glop";
    resolved=path.normalize(resolved);
    if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())
      throw new GlopModuleError(`module not found: ${specifier} (from ${fromFile})`,"MODULE_NOT_FOUND");
    return resolved;
  }
  parseFile(file){return parse(lex(fs.readFileSync(file,"utf8")))}
  load(file){
    const canonical=path.resolve(file);
    if(this.cache.has(canonical))return this.cache.get(canonical).exports;
    const cycle=this.loading.indexOf(canonical);
    if(cycle>=0)throw new GlopModuleError(`circular import detected: ${[...this.loading.slice(cycle),canonical].join(" -> ")}`,"MODULE_CYCLE");
    this.loading.push(canonical);
    try{
      const ast=this.parseFile(canonical);
      analyze(ast);
      const globals=new Map();
      for(const imp of ast.body.filter(s=>s.type==="ImportDecl"))
        globals.set(imp.alias,this.load(this.resolve(imp.path,canonical)));
      const vm=new VM(compileBytecode(ast),{output:this.output,globals});
      vm.run();
      const exports={};
      for(const s of ast.body.filter(s=>s.type==="ExportDecl"))
        for(const name of s.names){
          if(!vm.globals.has(name))throw new GlopModuleError(`cannot export undefined name "${name}" from ${canonical}`,"EXPORT_UNDEFINED");
          if(Object.prototype.hasOwnProperty.call(exports,name))throw new GlopModuleError(`duplicate export "${name}" from ${canonical}`,"EXPORT_DUPLICATE");
          exports[name]=vm.globals.get(name);
        }
      this.cache.set(canonical,{exports,file:canonical,vm});
      return exports;
    }finally{this.loading.pop()}
  }
  runEntry(file){
    const canonical=path.resolve(file);
    const ast=this.parseFile(canonical);
    analyze(ast);
    const globals=new Map();
    for(const imp of ast.body.filter(s=>s.type==="ImportDecl"))
      globals.set(imp.alias,this.load(this.resolve(imp.path,canonical)));
    return new VM(compileBytecode(ast),{output:this.output,globals}).run();
  }
}
