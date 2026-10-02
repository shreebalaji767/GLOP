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
  glop dump <file.glop|file.gbc>\n  glop trace <file.glop|file.gbc>`;

if (!cmd || !file) {
  console.log(usage);
  process.exit(cmd ? 1 : 0);
}

try {
  if (cmd === "trace") {
    const source = fs.readFileSync(file, "utf8");
    const ast = parse(lex(source));
    analyze(ast);
    const bc = file.toLowerCase().endsWith(".gbc") ? readGBC(file) : compileBytecode(ast);
    runBytecode(bc, { output: console.log, trace: true });
    process.exit(0);
  }

  if (cmd === "run" && file.toLowerCase().endsWith(".gbc")) {
    runBytecode(readGBC(file), { output: console.log });
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
    console.log(disassemble(compileBytecode(program)));
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
    writeGBC(compileBytecode(program), out);
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
