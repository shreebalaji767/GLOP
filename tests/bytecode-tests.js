import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";

const execute = source => {
  const output = [];
  const ast = parse(lex(source));
  const bc = compileBytecode(ast);
  const result = runBytecode(bc, { output: value => output.push(value) });
  return { output, result };
};

assert.deepEqual(execute("GLOP x=10\nGLOP y=20\nYAP x+y").output, [30]);
assert.deepEqual(execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(10,20)").output, [30]);
assert.deepEqual(execute("WIZARD square(x){ YEET x*x } YAP BONK square(7)").output, [49]);
assert.deepEqual(execute("WIZARD choose(x){ SUS x>10 { YEET 100 } NAH { YEET 200 } } YAP BONK choose(3)").output, [200]);
assert.deepEqual(execute("WIZARD nested(a){ GLOP b=5 YEET a+b } YAP BONK nested(7)").output, [12]);
assert.deepEqual(execute("WIZARD fact(n){ SUS n<=1 { YEET 1 } YEET n*BONK fact(n-1) } YAP BONK fact(5)").output, [120]);
assert.deepEqual(execute("GLOP x=0 SPIN x<5 { x+=1 } YAP x").output, [5]);
assert.deepEqual(execute("GLOP x=0 SPIN x<10 { x+=1 SUS x==5 { ZOOM } SUS x==8 { NOPE } YAP x }").output, [1,2,3,4,6,7]);

// A closure keeps captured state alive after its parent WIZARD returns.
assert.deepEqual(
  execute("WIZARD makeCounter(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } YEET inc } GLOP counter=BONK makeCounter(10) YAP BONK counter() YAP BONK counter()").output,
  [11,12]
);

// A closure can capture through more than one lexical function boundary.
assert.deepEqual(
  execute("WIZARD outer(a){ WIZARD middle(){ WIZARD inner(){ YEET a } YEET inner } YEET BONK middle()() } YAP BONK outer(42)").output,
  [42]
);

// Multiple closures created from the same parent share the same captured cell.
assert.deepEqual(
  execute("WIZARD makePair(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } WIZARD read(){ YEET x } YEET inc } GLOP f=BONK makePair(3) YAP BONK f() YAP BONK f()").output,
  [4,5]
);

assert.throws(
  () => execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(1)").output,
  /expected 2 argument/
);

console.log("GLOP BYTECODE VM FUNCTION TESTS PASSED.");
