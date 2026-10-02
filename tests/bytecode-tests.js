import assert from "node:assert/strict";
import {lex} from "../src/lexer.js";
import {parse} from "../src/parser.js";
import {compileBytecode} from "../src/bytecode-compiler.js";
import {runBytecode} from "../src/vm.js";

const out=[];
const bc=compileBytecode(parse(lex("GLOP x=10\nGLOP y=20\nYAP x+y")));
runBytecode(bc,{output:v=>out.push(v)});
assert.deepEqual(out,[30]);
console.log("BYTECODE VM TEST PASSED.");