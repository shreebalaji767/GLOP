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
