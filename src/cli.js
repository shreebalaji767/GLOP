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

  if (cmd === "build") {\n    const oi = rest.indexOf("-o");\n    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\\.glop$/, ".gbc");\n    writeGBC(compileBytecode(ast), out);\n    console.log("GLOP bytecode -> " + out);\n    process.exit(0);\n  }\n\n  const js = compile(ast);

  if (cmd === "compile") {
    const oi = rest.indexOf("-o");
    const out = oi >= 0 ? rest[oi + 1] : file.replace(/\.glop$/, ".mjs");
    fs.writeFileSync(out, js);
    console.log("GLOP compiled -> " + out);
    process.exit(0);
  }

  if (cmd === "run") {
    const tmp = path.join(process.cwd(), ".glop-run-" + process.pid + ".mjs");
    fs.writeFileSync(tmp, js);
    try {
      execFileSync(process.execPath, [tmp], { stdio: "inherit" });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    process.exit(0);
  }

  process.exit(1);
} catch (e) {
  console.error("GLOP OOPSIE: " + e.message);
  process.exit(1);
}
