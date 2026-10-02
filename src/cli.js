#!/usr/bin/env node
import fs from "node:fs";
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

const [, , cmd, file, ...rest] = process.argv;

if (cmd === "repl") {
  const { startRepl } = await import("./repl.js");
  await startRepl();
  process.exit(0);
}

const usage = `GLOP 0.13.0

  glop run <file.glop|file.gbc>
  glop repl
  glop compile <file.glop> [-o out.mjs]
  glop check <file.glop>
  glop build <file.glop> [-o out.gbc]
  glop tokens <file.glop>
  glop dump <file.glop|file.gbc>\n  glop trace <file.glop|file.gbc>\n  glop verify <file.gbc>`;

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
    const source = fs.readFileSync(file, "utf8");
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

  const source = fs.readFileSync(file, "utf8");
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
  console.error("GLOP OOPSIE: " + e.message);
  process.exit(1);
}
