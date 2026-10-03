import fs from "node:fs";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { compileBytecode } from "./bytecode-compiler.js";
import { verifyBytecode } from "./verifier.js";
import { readGBC } from "./gbc.js";
import { bundleModules } from "./module-bundler.js";

function countAst(node, counts = {}) {
  if (!node || typeof node !== "object") return counts;
  if (Array.isArray(node)) { for (const item of node) countAst(item, counts); return counts; }
  if (typeof node.type === "string") counts[node.type] = (counts[node.type] ?? 0) + 1;
  for (const [key, value] of Object.entries(node)) if (key !== "loc") countAst(value, counts);
  return counts;
}
function countCode(chunk, out = { instructions: 0, functions: 0 }) {
  out.instructions += chunk.code?.length ?? 0;
  out.functions += chunk.functions?.length ?? 0;
  for (const fn of chunk.functions ?? []) countCode(fn, out);
  return out;
}
function sourceInspection(file) {
  const source = fs.readFileSync(file, "utf8");
  const tokens = lex(source);
  const parsed = parse(tokens);
  const program = parsed.body.some(s => s.type === "ImportDecl" || s.type === "ExportDecl") ? bundleModules(file).ast : parsed;
  analyze(program);
  const bytecode = compileBytecode(program);
  const verification = verifyBytecode(bytecode);
  const code = countCode(bytecode);
  const ast = countAst(program);
  return { tool:"GLOP INSPECTOR", version:"0.14.0", file, sourceBytes:Buffer.byteLength(source,"utf8"), lines:source.split(/\r?\n/).length, tokens:tokens.length, astNodes:Object.values(ast).reduce((a,b)=>a+b,0), ast, bytecode:{instructions:code.instructions,functions:code.functions,maxStack:verification.maxStack,verified:true} };
}
export function inspect(file, { json=false, output=console.log }={}) {
  if (file.toLowerCase().endsWith(".gbc")) {
    const bc=readGBC(file), verification=verifyBytecode(bc), code=countCode(bc);
    const result={tool:"GLOP INSPECTOR",version:"0.14.0",file,bytecode:{instructions:code.instructions,functions:code.functions,maxStack:verification.maxStack,verified:true}};
    output(json ? JSON.stringify(result,null,2) : formatInspection(result)); return result;
  }
  const result=sourceInspection(file); output(json ? JSON.stringify(result,null,2) : formatInspection(result)); return result;
}
export function formatInspection(r) {
  const astLines=Object.entries(r.ast ?? {}).sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>"  "+name+": "+count);
  return ["╔══════════════════════════════════════════════════════╗","║                 GLOP INSPECTOR 0.14                 ║","╚══════════════════════════════════════════════════════╝","FILE       "+r.file,r.sourceBytes==null?null:"SOURCE     "+r.sourceBytes+" bytes / "+r.lines+" lines",r.tokens==null?null:"TOKENS     "+r.tokens,r.astNodes==null?null:"AST NODES  "+r.astNodes,"AST",...astLines,"BYTECODE","  instructions: "+r.bytecode.instructions,"  functions:    "+r.bytecode.functions,"  max stack:    "+r.bytecode.maxStack,"  verified:     "+(r.bytecode.verified?"YES — THE BYTECODE HAS BEEN QUESTIONED AND FOUND INNOCENT":"NO")].filter(Boolean).join("\n");
}