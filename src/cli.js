#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { compile } from "./compiler.js";
import { compileBytecode } from "./bytecode-compiler.js";
import { writeGBC } from "./gbc.js";
import { runBytecode } from "./vm.js";

const [, , cmd, file, ...rest] = process.argv;

if (!cmd || !file) {
  console.log("GLOP 0.3.0\n\n glop run <file.glop>\n glop compile <file.glop> [-o out.mjs]\n glop check <file.glop>\n glop tokens <file.glop>");
  process.exit(cmd ? 1 : 0);
}

try {
  const source = fs.readFileSync(file, "utf8");
  const tokens = lex(source);
  const ast = parse(tokens);

  if (cmd === "tokens") {
    console.log(JSON.stringify(tokens, null, 2));
    process.exit(0);
  }

  analyze(ast);

  if (cmd === "check") {
    console.log("GLOP OK: " + file);
    process.exit(0);
  }

  if (cmd === "build") {
    const oi = rest.indexOf("-o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\\.glop$/, ".gbc");
    writeGBC(compileBytecode(ast), out);
    console.log("GLOP bytecode -> " + out);
    process.exit(0);
  }

  const js = compile(ast);

  if (cmd === "compile") {
    const oi = rest.indexOf("-o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".mjs");
    fs.writeFileSync(out, js);
    console.log("GLOP compiled -> " + out);
    process.exit(0);
  }

  if (cmd === "run") {
    runBytecode(compileBytecode(ast));
    process.exit(0);
  }

  process.exit(1);
} catch (e) {
  console.error("GLOP OOPSIE: " + e.message);
  process.exit(1);
}
