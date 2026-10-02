import assert from"node:assert/strict";import{lex}from"../src/lexer.js";import{parse}from"../src/parser.js";import{compile}from"../src/compiler.js";
const run=s=>compile(parse(lex(s)));
assert.match(run("GLOP x = 10\nYAP x+2"),/let x=10/);
assert.match(run("WIZARD add(a,b){YEET a+b}\nYAP BONK add(2,3)"),/function add/);
assert.match(run("GLOP x=0\nSPIN x<3{x+=1}"),/while/);
assert.match(run("GLOP a=[1,2]\nGLOP p={name:«RAVI»}\nYAP p.name"),/"name":"RAVI"/);
console.log("ALL GLOP TESTS PASSED.");