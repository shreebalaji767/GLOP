import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { analyze, GlopSemanticError } from "../src/semantic.js";

const check = source => analyze(parse(lex(source)));

check("GLOP x = 10\nYAP x");
check("WIZARD add(a,b){ YEET a+b }\nYAP BONK add(2,3)");
check("WIZARD outer(){ GLOP x=1 WIZARD inner(){ YEET x } YEET BONK inner() }");
check("SPIN BASED { NOPE ZOOM }");
check("TRY { OOPSIE «bad» } CATCH error { YAP error }");
check("GLOP p={name:«RAVI»}\nYAP p.name");
check("GLOP x=10\nGLOP y=x+5\nYAP y");
check("GLOP x=«A»\nGLOP y=x+«B»\nYAP y");

assert.throws(
  () => check("YAP missing"),
  e => e instanceof GlopSemanticError && e.code === "UNDEFINED_NAME"
);

assert.throws(
  () => check("GLOP x=1\nGLOP x=2"),
  e => e instanceof GlopSemanticError && e.code === "DUPLICATE_DECLARATION"
);

assert.throws(
  () => check("x = 10"),
  e => e instanceof GlopSemanticError && e.code === "UNDEFINED_NAME"
);

assert.throws(
  () => check("YEET 10"),
  e => e instanceof GlopSemanticError && e.code === "RETURN_OUTSIDE_FUNCTION"
);

assert.throws(
  () => check("NOPE"),
  e => e instanceof GlopSemanticError && e.code === "BREAK_OUTSIDE_LOOP"
);

assert.throws(
  () => check("ZOOM"),
  e => e instanceof GlopSemanticError && e.code === "CONTINUE_OUTSIDE_LOOP"
);

assert.throws(
  () => check("WIZARD bad(a,a){ YEET a }"),
  e => e instanceof GlopSemanticError && e.code === "DUPLICATE_DECLARATION"
);

assert.throws(
  () => check("WIZARD bad(){ YEET missing }"),
  e => e instanceof GlopSemanticError && e.code === "UNDEFINED_NAME"
);

console.log("GLOP SEMANTIC TESTS PASSED.");


check("SUS BASED { YAP «YES» }");
check("SPIN CAP { NOPE }");
check("GLOP x=10 GLOP y=x+2");
check("GLOP x=«A» GLOP y=x+«B»");

assert.throws(() => check("SUS 123 { YAP 1 }"), e => e instanceof GlopSemanticError && e.code === "TYPE_ERROR");
assert.throws(() => check("GLOP x=«A» GLOP y=x-1"), e => e instanceof GlopSemanticError && e.code === "TYPE_ERROR");
assert.throws(() => check("GLOP x=10 GLOP x=«A»"), e => e instanceof GlopSemanticError && e.code === "DUPLICATE_DECLARATION");
assert.throws(() => check("GLOP x=10 BONK x()"), e => e instanceof GlopSemanticError && e.code === "TYPE_ERROR");
assert.throws(() => check("WIZARD add(a,b){ YEET a+b } BONK add(1)"), e => e instanceof GlopSemanticError && e.code === "ARITY_ERROR");

console.log("GLOP STRONG SEMANTIC TESTS PASSED.");
