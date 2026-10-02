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

if (cmd === "repl") {\n  const { startRepl } = await import("./repl.js");\n  await startRepl();\n  process.exit(0);\n}\n\nif (!cmd || !file) {
  console.log("GLOP 0.11.0\n\n glop run <file.glop|file.gbc>\n glop repl\n glop compile <file.glop> [-o out.mjs]\n glop check <file.glop>\n glop build <file.glop> [-o out.gbc]\n glop tokens <file.glop>\n glop dump <file.glop|file.gbc>");
  process.exit(cmd ? 1 : 0);
}

try {
  if (cmd === "run" && file.toLowerCase().endsWith(".gbc")) {
    runBytecode(readGBC(file), { output: console.log });
    process.exit(0);
  }

  const source = fs.readFileSync(file, "utf8");
  const tokens = lex(source);
  const ast = parse(tokens);

  if (cmd === "dump") {\n    if (file.toLowerCase().endsWith(".gbc")) {\n      console.log(disassemble(readGBC(file)));\n    } else {\n      const program = ast.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl")\n        ? bundleModules(file).ast\n        : ast;\n      analyze(program);\n      console.log(disassemble(compileBytecode(program)));\n    }\n    process.exit(0);\n  }\n\n  if (cmd === "tokens") {
    console.log(JSON.stringify(tokens, null, 2));
    process.exit(0);
  }

  analyze(ast);

  if (cmd === "check") {
    new ModuleLoader({output:()=>{}}).check(file);
    console.log("GLOP OK: " + file);
    process.exit(0);
  }

  if (cmd === "build") {
    const oi = rest.indexOf("-o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".gbc");
    const program = ast.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl")
      ? bundleModules(file).ast
      : ast;
    writeGBC(compileBytecode(program), out);
    console.log("GLOP bytecode -> " + out);
    process.exit(0);
  }

  if (cmd === "compile") {
    const js = compile(ast);
    const oi = rest.indexOf("-o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".mjs");
    fs.writeFileSync(out, js);
    console.log("GLOP compiled -> " + out);
    process.exit(0);
  }

  if (cmd === "run") {
    new ModuleLoader({output:console.log}).runEntry(file);
    process.exit(0);
  }

  process.exit(1);
} catch (e) {
  console.error("GLOP OOPSIE: " + e.message);
  process.exit(1);
}
