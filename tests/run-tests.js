import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compile } from "../src/compiler.js";
import { analyze, GlopSemanticError } from "../src/semantic.js";

const run = s => compile(parse(lex(s)));
const check = s => analyze(parse(lex(s)));

assert.match(run("GLOP x = 10\nYAP x+2"), /let x=10/);
assert.equal(lex("YAP 1e3")[1].value,1000);
assert.doesNotThrow(() => lex("/* GLOP is chaos */ YAP 42"));
assert.match(run("WIZARD add(a,b){YEET a+b}\nYAP BONK add(2,3)"), /function add/);\nassert.match(run("GLOP add=WIZARD(a,b){YEET a+b}\nYAP BONK add(2,3)"), /function\\(a,b\\)/);
assert.match(run("GLOP x=0\nSPIN x<3{x+=1}"), /while/);
assert.match(run("GLOP a=[1,2]\nGLOP p={name:«RAVI»}\nYAP p.name"), /"name":"RAVI"/);
assert.match(run("WIZARD add(a,b){YEET a+b}\nWIZARD wrap(x,y){YEET x+y}\nYAP BONK wrap(BONK add(1,2),BONK add(3,4))"), /function wrap/);
assert.match(run("WIZARD make(x){YEET x}\nYAP BONK make(1)(2)"), /function make/);
assert.match(run("GLOP a=[1,2,]\nGLOP p={name:«RAVI»,age:25,}\nYAP p.name"), /"name":"RAVI"/);
assert.doesNotThrow(() => parse(lex("YAP BONK add(1,)")));
assert.throws(() => parse(lex("YAP BONK add(1,,2)")), /Expected expression after comma/);
assert.throws(() => parse(lex("YAP BONK add(1 2)")), /Expected , or \) after call argument/);
assert.throws(() => parse(lex("YAP BONK add(BONK inner(1,2)")), /Expected , or \) after call argument|Expected \) after call argument/);
assert.throws(() => parse(lex("YAP [1,,2]")), /Expected array element/);
assert.throws(() => parse(lex("YAP {name:«RAVI»,,age:25}")), /Expected object property/);
const deep="YAP "+"(".repeat(1100)+"1"+")".repeat(1100);
assert.throws(() => parse(lex(deep),{maxExpressionDepth:1000}), e => e.code === "PARSE_LIMIT");
assert.throws(() => parse(lex("YAP BONK f(1,2,3)"),{maxCallArgs:2}), e => e.code === "PARSE_LIMIT");
assert.throws(() => parse(lex("YAP [1,2,3]"),{maxArrayElements:2}), e => e.code === "PARSE_LIMIT");
assert.throws(() => parse(lex("YAP {a:1,b:2,c:3}"),{maxObjectProperties:2}), e => e.code === "PARSE_LIMIT");
assert.throws(() => parse(lex("WIZARD f(a,b,c){YEET a}"),{maxParameters:2}), e => e.code === "PARSE_LIMIT");
assert.throws(() => parse(lex("YAP 1\nYAP 2\nYAP 3"),{maxStatements:2}), e => e.code === "PARSE_LIMIT");

check("GLOP x=10\nYAP x");
assert.throws(() => check("YAP missing"), e => e instanceof GlopSemanticError && e.code === "UNDEFINED_NAME");
assert.throws(() => check("YEET 1"), e => e instanceof GlopSemanticError && e.code === "RETURN_OUTSIDE_FUNCTION");

console.log("ALL GLOP TESTS PASSED.");
