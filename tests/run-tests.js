import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compile } from "../src/compiler.js";
import { analyze, GlopSemanticError } from "../src/semantic.js";

const run = s => compile(parse(lex(s)));
const check = s => analyze(parse(lex(s)));

assert.match(run("GLOP x = 10\nYAP x+2"), /let x=10/);
assert.match(run("WIZARD add(a,b){YEET a+b}\nYAP BONK add(2,3)"), /function add/);
assert.match(run("GLOP x=0\nSPIN x<3{x+=1}"), /while/);
assert.match(run("GLOP a=[1,2]\nGLOP p={name:«RAVI»}\nYAP p.name"), /"name":"RAVI"/);

check("GLOP x=10\nYAP x");
assert.throws(() => check("YAP missing"), e => e instanceof GlopSemanticError && e.code === "UNDEFINED_NAME");
assert.throws(() => check("YEET 1"), e => e instanceof GlopSemanticError && e.code === "RETURN_OUTSIDE_FUNCTION");

console.log("ALL GLOP TESTS PASSED.");
