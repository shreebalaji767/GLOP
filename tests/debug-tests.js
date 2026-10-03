import assert from "node:assert/strict";
import { parse } from "../src/parser.js";
import { lex } from "../src/lexer.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";

const logs=[];
const bc=compileBytecode(parse(lex("GLOP x = 2 YAP x + 3")));
const result=runBytecode(bc,{output:()=>{},breakpoints:[1],debugOutput:s=>logs.push(s)});
assert.equal(result,undefined);
assert.ok(logs.some(x=>x.includes("[GLOP DEBUG]")));
assert.ok(logs.some(x=>x.includes("STORE_GLOBAL")));
assert.ok(logs.some(x=>x.includes("locals") || x.includes("call stack") || x.includes("[GLOP DEBUG]")));
console.log("GLOP DEBUGGER TEST PASSED.");
