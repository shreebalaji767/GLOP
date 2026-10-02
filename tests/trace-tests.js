import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";

const lines=[];
runBytecode(compileBytecode(parse(lex("GLOP x = 2 YAP x + 3"))),{output:()=>{},trace:true,traceOutput:s=>lines.push(s)});
assert.ok(lines.some(x=>x.includes("CONST")));
assert.ok(lines.some(x=>x.match(/\\d+:\\d+/)));
assert.ok(lines.some(x=>x.includes("STORE_GLOBAL")));
assert.ok(lines.some(x=>x.includes("PRINT")));
console.log("GLOP VM TRACE TEST PASSED.");
