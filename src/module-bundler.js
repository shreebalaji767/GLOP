import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { node } from "./ast.js";

export class GlopBundleError extends Error {
  constructor(message, code = "BUNDLE_ERROR") {
    super(`GLOP BUNDLE OOPSIE: ${message}`);
    this.name = "GlopBundleError";
    this.code = code;
  }
}

export class ModuleBundler {
  constructor() {
    this.modules = new Map();
    this.order = [];
  }

  resolve(specifier, fromFile) {
    if (!specifier || typeof specifier !== "string")
      throw new GlopBundleError("empty module path", "MODULE_PATH");
    if (!specifier.startsWith("./") && !specifier.startsWith("../") && !path.isAbsolute(specifier))
      throw new GlopBundleError(`only relative module paths are supported: ${specifier}`, "MODULE_PATH");

    let resolved = path.resolve(path.dirname(fromFile), specifier);
    if (!path.extname(resolved)) resolved += ".glop";
    resolved = path.normalize(resolved);

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile())
      throw new GlopBundleError(`module not found: ${specifier} (from ${fromFile})`, "MODULE_NOT_FOUND");
    return resolved;
  }

  parseFile(file) {
    return parse(lex(fs.readFileSync(file, "utf8")));
  }

  visit(file, stack = []) {
    const canonical = path.resolve(file);
    if (this.modules.has(canonical)) return this.modules.get(canonical);

    if (stack.includes(canonical)) {
      const cycle = [...stack.slice(stack.indexOf(canonical)), canonical].join(" -> ");
      throw new GlopBundleError(`circular import detected: ${cycle}`, "MODULE_CYCLE");
    }

    const ast = this.parseFile(canonical);
    analyze(ast);

    const record = { file: canonical, ast, imports: [], factoryName: null, namespaceName: null };
    this.modules.set(canonical, record);

    for (const imp of ast.body.filter(s => s.type === "ImportDecl")) {
      const dep = this.visit(this.resolve(imp.path, canonical), [...stack, canonical]);
      record.imports.push({ ast: imp, dep });
    }

    this.order.push(record);
    return record;
  }

  generatedNames(records) {
    const used = new Set();
    const collect = statements => {
      for (const s of statements) {
        if (s.type === "VarDecl" || s.type === "FunctionDecl") used.add(s.name);
        if (s.type === "If") {
          collect(s.consequent);
          if (s.alternate) collect(s.alternate);
        }
        if (s.type === "While") collect(s.body);
        if (s.type === "TryCatch") {
          collect(s.tryBody);
          collect(s.catchBody);
        }
      }
    };
    for (const r of records) collect(r.ast.body);

    let serial = 0;
    for (const r of records) {
      let factory;
      do factory = `__glop_module_factory_${serial++}`; while (used.has(factory));
      used.add(factory);
      let namespace;
      do namespace = `__glop_module_namespace_${serial++}`; while (used.has(namespace));
      used.add(namespace);
      r.factoryName = factory;
      r.namespaceName = namespace;
    }
  }

  factoryFor(record) {
    const importNames = record.imports.map(x => x.ast.alias);
    const exports = record.ast.body.find(s => s.type === "ExportDecl");
    const body = record.ast.body.filter(s => s.type !== "ImportDecl" && s.type !== "ExportDecl");

    const properties = (exports?.names ?? []).map(name => ({ key: name, value: node("Identifier", { name }) }));
    body.push(node("Return", {
      value: node("Object", { properties })
    }));

    return node("FunctionDecl", {
      name: record.factoryName,
      params: importNames,
      body
    });
  }

  build(entryFile) {
    const entry = this.visit(entryFile);
    this.generatedNames(this.order);

    const body = [];

    // Every factory is defined first, so native and JS bytecode execution
    // have the same deterministic function table and initialization order.
    for (const record of this.order) body.push(this.factoryFor(record));

    // Dependencies are initialized exactly once, in dependency-before-dependent
    // order. Their namespace objects are passed into factory parameters.
    for (const record of this.order) {
      const args = record.imports.map(({ dep }) => node("Identifier", { name: dep.namespaceName }));
      body.push(node("VarDecl", {
        name: record.namespaceName,
        value: node("Call", {
          callee: node("Identifier", { name: record.factoryName }),
          args
        })
      }));
    }

    // The entry module executes at top level, while its imported namespaces
    // become ordinary globals. Module-local state stays inside each factory.
    for (const imp of entry.imports) {
      body.push(node("VarDecl", {
        name: imp.ast.alias,
        value: node("Identifier", { name: imp.dep.namespaceName })
      }));
    }

    body.push(...entry.ast.body.filter(s => s.type !== "ImportDecl" && s.type !== "ExportDecl"));

    const bundled = node("Program", { body });
    analyze(bundled);
    return { ast: bundled, modules: this.order };
  }
}

export const bundleModules = entryFile => new ModuleBundler().build(entryFile);
