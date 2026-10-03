#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { compile } from "./compiler.js";
import { compileBytecode } from "./bytecode-compiler.js";
import { writeGBC, readGBC } from "./gbc.js";
import { runBytecode } from "./vm.js";
import { ModuleLoader } from "./module-loader.js";
import { bundleModules } from "./module-bundler.js";
import { disassemble } from "./disassembler.js";
import { verifyBytecode } from "./verifier.js";
import { inspect } from "./inspect.js";
import { findProject, readProject, initProject, addDependency, removeDependency, installProject } from "./project.js";

let [, , cmd, file, ...rest] = process.argv;

const VERSION = "0.24.0";
let source = "";

const usage = `GLOP ${VERSION}

  glop run <file.glop|file.gbc>
  glop repl
  glop compile <file.glop> [-o out.mjs]
  glop check <file.glop>
  glop build <file.glop> [-o out.gbc]
  glop tokens <file.glop>
  glop dump <file.glop|file.gbc>\n  glop trace <file.glop|file.gbc>\n  glop verify <file.gbc>\n  glop inspect <file.glop|file.gbc> [--json]\n  glop debug <file.glop|file.gbc> [--break N] [--step]
  glop --version
  glop --help`;

const HELP_FLAGS = new Set(["help", "--help", "-h"]);
const VERSION_FLAGS = new Set(["version", "--version", "-v"]);

if (VERSION_FLAGS.has(cmd)) {
  console.log(`GLOP ${VERSION}`);
  process.exit(0);
}

if (HELP_FLAGS.has(cmd)) {
  console.log(usage);
  process.exit(0);
}

if (cmd === "init") {
  try {
    const created = initProject(file || ".");
    console.log("GLOP PROJECT CREATED: " + created.root);
    console.log("  manifest: " + path.join(created.root, "glop.toml"));
    console.log("  entry:    " + path.join(created.root, created.manifest.package.entry));
    process.exit(0);
  } catch (e) { console.error("GLOP INIT ERROR: " + e.message); process.exit(1); }
}

if (cmd === "add") {
  try {
    const name = file;
    const spec = rest[0];
    if (!name || !spec) throw new Error("usage: glop add <name> <path>");
    const root = findProject() || process.cwd();
    const saved = addDependency(root, name, spec);
    installProject(root);
    console.log(`GLOP DEPENDENCY ADDED: ${name} -> ${saved}`);
    process.exit(0);
  } catch (e) { console.error("GLOP ADD ERROR: " + e.message); process.exit(1); }
}

if (cmd === "remove") {
  try {
    if (!file) throw new Error("usage: glop remove <name>");
    const root = findProject();
    if (!root) throw new Error("no glop.toml found");
    removeDependency(root, file);
    installProject(root);
    console.log("GLOP DEPENDENCY REMOVED: " + file);
    process.exit(0);
  } catch (e) { console.error("GLOP REMOVE ERROR: " + e.message); process.exit(1); }
}

if (cmd === "install") {
  try {
    const root = findProject();
    if (!root) throw new Error("no glop.toml found");
    const lock = installProject(root);
    console.log("GLOP INSTALL COMPLETE: " + Object.keys(lock.dependencies).length + " dependency(ies)");
    process.exit(0);
  } catch (e) { console.error("GLOP INSTALL ERROR: " + e.message); process.exit(1); }
}

if (cmd === "project") {
  try {
    const root = findProject();
    if (!root) throw new Error("no glop.toml found");
    const project = readProject(root);
    console.log(JSON.stringify({ root: project.root, package: project.manifest.package, dependencies: project.manifest.dependencies }, null, 2));
    process.exit(0);
  } catch (e) { console.error("GLOP PROJECT ERROR: " + e.message); process.exit(1); }
}

if (cmd === "test") {
  try {
    const root = findProject();
    if (!root) throw new Error("no glop.toml found");
    const project = readProject(root);
    const testsDir = path.join(root, "tests");
    if (!fs.existsSync(testsDir)) throw new Error("tests directory not found");
    const files = fs.readdirSync(testsDir).filter(x => x.endsWith(".glop")).sort();
    if (!files.length) { console.log("GLOP TEST: no .glop tests found"); process.exit(0); }
    const { ModuleLoader } = await import("./module-loader.js");
    for (const name of files) {
      console.log("GLOP TEST: " + name);
      new ModuleLoader({ output: console.log }).runEntry(path.join(testsDir, name));
    }
    console.log("GLOP TESTS PASSED: " + files.length);
    process.exit(0);
  } catch (e) { console.error("GLOP TEST ERROR: " + e.message); process.exit(1); }
}

if (!file && ["run", "check", "build", "compile", "debug", "dump", "tokens", "trace"].includes(cmd)) {
  const root = findProject();
  if (root) {
    const project = readProject(root);
    file = path.join(root, project.manifest.package.entry);
  }
}

if (cmd === "repl") {
  const { startRepl } = await import("./repl.js");
  await startRepl();
  process.exit(0);
}

if (cmd === "fmt") {
  if (!file) { console.log(usage); process.exit(1); }
  try {
    source = fs.readFileSync(file, "utf8");
    const tokens = lex(source);
    const ast = parse(tokens);
    const lines = [];
    const emit = (s, depth = 0) => lines.push("    ".repeat(depth) + s);
    const lit = v => typeof v === "string" ? "«" + v.replace(/«/g, "\\«").replace(/»/g, "\\»") + "»" : String(v);
    const expr = e => {
      if (!e) return "";
      if (e.type === "Literal") return e.value === null ? "VOID" : lit(e.value);
      if (e.type === "Identifier") return e.name;
      if (e.type === "Array") return "[" + e.elements.map(expr).join(", ") + "]";
      if (e.type === "Object") return "{ " + e.properties.map(p => p.key + ": " + expr(p.value)).join(", ") + " }";
      if (e.type === "Unary") return e.op + expr(e.argument);
      if (e.type === "Binary") return expr(e.left) + " " + e.op + " " + expr(e.right);
      if (e.type === "Member") return expr(e.object) + "." + e.property;
      if (e.type === "Index") return expr(e.object) + "[" + expr(e.index) + "]";
      if (e.type === "Call") return "BONK " + expr(e.callee) + "(" + e.args.map(expr).join(", ") + ")";
      if (e.type === "New") return "NEW " + expr(e.callee) + "(" + e.args.map(expr).join(", ") + ")";
      return "<expression>";
    };
    const stmt = (s, depth = 0) => {
      if (s.type === "VarDecl") { emit("GLOP " + s.name + (s.declaredType ? ":" + s.declaredType : "") + " = " + expr(s.value), depth); return; }
      if (s.type === "Print") { emit("YAP " + expr(s.expression), depth); return; }
      if (s.type === "ExpressionStatement") { emit(expr(s.expression), depth); return; }
      if (s.type === "Assignment") { emit(expr(s.target) + " " + s.op + " " + expr(s.value), depth); return; }
      if (s.type === "Return") { emit("YEET " + expr(s.value), depth); return; }
      if (s.type === "Break") { emit("NOPE", depth); return; }
      if (s.type === "Continue") { emit("ZOOM", depth); return; }
      if (s.type === "Throw") { emit("OOPSIE " + expr(s.value), depth); return; }
      if (s.type === "ImportDecl") { emit('STEAL «' + s.path + '» AS ' + s.alias, depth); return; }
      if (s.type === "ExportDecl") { emit("FLEX " + s.names.join(", "), depth); return; }
      if (s.type === "If") { emit("SUS " + expr(s.test) + " {", depth); s.consequent.forEach(x => stmt(x, depth + 1)); emit("}" + (s.alternate ? " NAH {" : ""), depth); if (s.alternate) { s.alternate.forEach(x => stmt(x, depth + 1)); emit("}", depth); } return; }
      if (s.type === "While") { emit("SPIN " + expr(s.test) + " {", depth); s.body.forEach(x => stmt(x, depth + 1)); emit("}", depth); return; }
      if (s.type === "FunctionDecl") { emit("WIZARD " + s.name + "(" + s.params.map((p,i) => p + (s.paramTypes?.[i] ? ":" + s.paramTypes[i] : "")).join(", ") + ")" + (s.returnType ? ":" + s.returnType : "") + " {", depth); s.body.forEach(x => stmt(x, depth + 1)); emit("}", depth); return; }
      emit("// formatter could not reconstruct " + s.type, depth);
    };
    ast.body.forEach(s => stmt(s));
    const formatted = lines.join("\n") + "\n";
    const oi = rest.indexOf("-o");
    if (oi >= 0 && !rest[oi + 1]) throw new Error("missing output path after -o");
    const out = oi >= 0 ? rest[oi + 1] : file;
    fs.writeFileSync(out, formatted);
    console.log("GLOP formatted -> " + out);
    process.exit(0);
  } catch (e) { console.error("GLOP FORMAT ERROR: " + e.message); process.exit(1); }
}

if (cmd === "lint") {
  if (!file) { console.log(usage); process.exit(1); }
  try {
    source = fs.readFileSync(file, "utf8");
    const ast = parse(lex(source));
    const warnings = [];
    const declared = new Set();
    const walkExpr = e => {
      if (!e) return;
      if (e.type === "Identifier" && !declared.has(e.name) && !["THIS","SUPER"].includes(e.name)) warnings.push(`possibly undefined identifier "${e.name}"`);
      if (e.type === "Binary") { walkExpr(e.left); walkExpr(e.right); }
      if (e.type === "Unary") walkExpr(e.argument);
      if (e.type === "Call" || e.type === "New") { walkExpr(e.callee); e.args.forEach(walkExpr); }
      if (e.type === "Member") walkExpr(e.object);
      if (e.type === "Index") { walkExpr(e.object); walkExpr(e.index); }
      if (e.type === "Array") e.elements.forEach(walkExpr);
      if (e.type === "Object") e.properties.forEach(p => walkExpr(p.value));
    };
    const walk = s => {
      if (s.type === "VarDecl") { walkExpr(s.value); declared.add(s.name); }
      else if (s.type === "Print" || s.type === "ExpressionStatement") walkExpr(s.expression);
      else if (s.type === "Assignment") { walkExpr(s.target); walkExpr(s.value); }
      else if (s.type === "Return" || s.type === "Throw") walkExpr(s.value);
      else if (s.type === "If") { walkExpr(s.test); s.consequent.forEach(walk); s.alternate?.forEach(walk); }
      else if (s.type === "While") { walkExpr(s.test); s.body.forEach(walk); }
      else if (s.type === "FunctionDecl") { const old = new Set(declared); s.params.forEach(p => declared.add(p)); s.body.forEach(walk); declared.clear(); old.forEach(x => declared.add(x)); }
    };
    ast.body.forEach(walk);
    if (warnings.length) { for (const w of warnings) console.log("GLOP LINT: warning: " + w); process.exitCode = 1; }
    else console.log("GLOP LINT: clean");
    process.exit(0);
  } catch (e) { console.error("GLOP LINT ERROR: " + e.message); process.exit(1); }
}

if (cmd === "doctor") {
  const checks = [
    ["Node.js", Number(process.versions.node.split(".")[0]) >= 18, process.versions.node],
    ["package.json", fs.existsSync(new URL("../package.json", import.meta.url)), "present"],
    ["project manager", fs.existsSync(new URL("./project.js", import.meta.url)), "present"],
    ["lexer", fs.existsSync(new URL("./lexer.js", import.meta.url)), "present"],
    ["parser", fs.existsSync(new URL("./parser.js", import.meta.url)), "present"],
    ["bytecode VM", fs.existsSync(new URL("./vm.js", import.meta.url)), "present"],
    ["native runtime source", fs.existsSync(new URL("../runtime/native/glop.cpp", import.meta.url)), "present"]
  ];
  console.log("GLOP DOCTOR");
  console.log("============");
  let failed = 0;
  for (const [name, ok, detail] of checks) {
    console.log((ok ? "✓" : "✗") + " " + name + " — " + detail);
    if (!ok) failed++;
  }
  console.log("");
  if (failed) {
    console.log("DIAGNOSIS: " + failed + " check(s) need attention.");
    process.exit(1);
  }
  console.log("DIAGNOSIS: GLOP is ready to cause responsible chaos.");
  process.exit(0);
}




if (cmd === "debug") {
  if (!file) { console.log(usage); process.exit(1); }
  const breaks=[]; for(let i=0;i<rest.length;i++) if(rest[i]==="--break"){const n=Number(rest[++i]);if(!Number.isInteger(n))throw new Error("--break expects a line number");breaks.push(n);}
  const step=rest.includes("--step");
  try {
    let bc;
    if(file.toLowerCase().endsWith(".gbc")) bc=readGBC(file);
    else {
      source=fs.readFileSync(file,"utf8");
      const a=parse(lex(source));
      const program=a.body.some(s=>s.type==="ImportDecl"||s.type==="ExportDecl") ? bundleModules(file).ast : a;
      analyze(program); bc=compileBytecode(program);
    }
    verifyBytecode(bc);
    runBytecode(bc,{output:console.log,breakpoints:breaks,debugStep:step,debugOutput:console.error});
    process.exit(0);
  } catch(e) { console.error("GLOP DEBUGGER ERROR: "+e.message); process.exit(1); }
}

if (cmd === "inspect") {
  if (!file) { console.log(usage); process.exit(1); }
  try { inspect(file, { json: rest.includes("--json") }); process.exit(0); }
  catch (e) { console.error(`GLOP OOPSIE: ${e.message}`); process.exit(1); }
}

if (!cmd || !file) {
  console.log(usage);
  process.exit(cmd ? 1 : 0);
}

try {
  if (cmd === "trace") {
    if (file.toLowerCase().endsWith(".gbc")) {
      const bc = readGBC(file);
      const report = verifyBytecode(bc);
      console.log("GLOP BYTECODE OK: max stack " + report.maxStack);
      runBytecode(bc, { output: console.log, trace: true });
      process.exit(0);
    }
    source = fs.readFileSync(file, "utf8");
    const ast = parse(lex(source));
    const program = ast.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl")
      ? bundleModules(file).ast
      : ast;
    analyze(program);
    const bc = compileBytecode(program);
    const report = verifyBytecode(bc);
    console.log("GLOP BYTECODE OK: max stack " + report.maxStack);
    runBytecode(bc, { output: console.log, trace: true });
    process.exit(0);
  }

  if (cmd === "verify") {
    if (!file.toLowerCase().endsWith(".gbc")) throw new Error("verify expects a .gbc file");
    const bc = readGBC(file);
    const report = verifyBytecode(bc);
    console.log("GLOP BYTECODE VERIFIED: " + file + " | max stack " + report.maxStack);
    process.exit(0);
  }

  if (cmd === "run" && file.toLowerCase().endsWith(".gbc")) {
    const bc=readGBC(file); verifyBytecode(bc); runBytecode(bc, { output: console.log });
    process.exit(0);
  }

  source = fs.readFileSync(file, "utf8");
  const tokens = lex(source);
  const ast = parse(tokens);

  if (cmd === "dump") {
    const program = ast.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl")
      ? bundleModules(file).ast
      : ast;
    analyze(program);
    const bc=compileBytecode(program); verifyBytecode(bc); console.log(disassemble(bc));
    process.exit(0);
  }

  if (cmd === "tokens") {
    console.log(JSON.stringify(tokens, null, 2));
    process.exit(0);
  }

  if (cmd === "check") {
    new ModuleLoader({ output: () => {} }).check(file);
    console.log("GLOP OK: " + file);
    process.exit(0);
  }

  if (cmd === "build") {
    const oi = rest.indexOf("-o");
    if (oi >= 0 && !rest[oi + 1]) throw new Error("missing output path after -o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".gbc");
    const program = ast.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl")
      ? bundleModules(file).ast
      : ast;
    analyze(program);
    const bc=compileBytecode(program); verifyBytecode(bc); writeGBC(bc, out);
    console.log("GLOP bytecode -> " + out);
    process.exit(0);
  }

  if (cmd === "compile") {
    analyze(ast);
    const js = compile(ast);
    const oi = rest.indexOf("-o");
    if (oi >= 0 && !rest[oi + 1]) throw new Error("missing output path after -o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".mjs");
    fs.writeFileSync(out, js);
    console.log("GLOP compiled -> " + out);
    process.exit(0);
  }

  if (cmd === "run") {
    new ModuleLoader({ output: console.log }).runEntry(file);
    process.exit(0);
  }

  throw new Error("unknown command: " + cmd);
} catch (e) {
  const line=Number.isInteger(e.line)?e.line:null;
  const column=Number.isInteger(e.column)?e.column:null;
  const code=e.code ? ` [${e.code}]` : "";
  console.error(`GLOP OOPSIE${code}: ${e.message}`);
  if(line!==null && column!==null && typeof source === "string"){
    const lines=source.split(/\r?\n/);
    const text=lines[line-1]??"";
    console.error(`  ${line} | ${text}`);
    console.error(`    | ${" ".repeat(Math.max(0,column-1))}^`);
  }
  process.exit(1);
}
