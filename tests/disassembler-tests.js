import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { disassemble } from "../src/disassembler.js";

const bc=compileBytecode(parse(lex("GLOP x=10 YAP x")));
const text=disassemble(bc);
assert.match(text,/FUNCTION <main>/);
assert.match(text,/LOAD_GLOBAL/);
assert.match(text,/PRINT/);
console.log("GLOP DISASSEMBLER TEST PASSED.");
