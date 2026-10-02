import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { verifyBytecode, GlopBytecodeError } from "../src/verifier.js";

const bc=compileBytecode(parse(lex("GLOP x = 10 YAP x")));
assert.equal(verifyBytecode(bc),true);
const bad=structuredClone(bc);
bad.code[0]={op:"NOPE_OPCODE",arg:null};
assert.throws(()=>verifyBytecode(bad),GlopBytecodeError);
console.log("GLOP BYTECODE VERIFIER TEST PASSED.");
