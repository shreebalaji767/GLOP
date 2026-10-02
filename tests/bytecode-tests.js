import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";
import { encodeGBC } from "../src/gbc.js";

const execute=source=>{const output=[];const result=runBytecode(compileBytecode(parse(lex(source))),{output:value=>output.push(value)});return{output,result}};

assert.deepEqual(execute("GLOP x=[10,20,30] YAP x[1]").output,[20]);
assert.deepEqual(execute("TRY { OOPSIE «BAD» } CATCH error { YAP error }").output,["BAD"]);
assert.deepEqual(execute("WIZARD fail(){ OOPSIE «BOOM» } TRY { BONK fail() } CATCH error { YAP error }").output,["BOOM"]);
assert.deepEqual(execute("TRY { YAP 1 OOPSIE «STOP» YAP 2 } CATCH error { YAP error }").output,[1,"STOP"]);
assert.deepEqual(execute("TRY { TRY { OOPSIE «INNER» } CATCH e { OOPSIE e } } CATCH outer { YAP outer }").output,["INNER"]);
assert.deepEqual(execute("YAP BASED && BASED YAP CAP || BASED").output,[true,true]);
assert.deepEqual(execute("GLOP x=[10,20] x[1]=99 YAP x[1]").output,[99]);
assert.deepEqual(execute("GLOP p={name:«RAVI»,age:25} YAP p.name YAP p.age").output,["RAVI",25]);
assert.deepEqual(execute("GLOP p={age:25} p.age=30 YAP p.age").output,[30]);
assert.deepEqual(execute("GLOP x=[1,2] YAP x[0] YAP x[1]").output,[1,2]);
assert.deepEqual(execute("WIZARD make(){ YEET [1,2,3] } GLOP x=BONK make() YAP x[2]").output,[3]);

assert.deepEqual(execute("GLOP x=10 GLOP y=20 YAP x+y").output,[30]);
assert.deepEqual(execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(10,20)").output,[30]);
assert.deepEqual(execute("WIZARD square(x){ YEET x*x } YAP BONK square(7)").output,[49]);
assert.deepEqual(execute("WIZARD fact(n){ SUS n<=1 { YEET 1 } YEET n*BONK fact(n-1) } YAP BONK fact(5)").output,[120]);

assert.deepEqual(execute("WIZARD makeCounter(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } YEET inc } GLOP counter=BONK makeCounter(10) YAP BONK counter() YAP BONK counter()").output,[11,12]);
assert.deepEqual(execute("WIZARD outer(a){ WIZARD middle(){ WIZARD inner(){ YEET a } YEET inner } YEET BONK middle()() } YAP BONK outer(42)").output,[42]);
assert.deepEqual(execute("WIZARD makePair(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } WIZARD read(){ YEET x } YEET inc } GLOP f=BONK makePair(3) YAP BONK f() YAP BONK f()").output,[4,5]);
const closureAst=parse(lex("WIZARD outer(a){ WIZARD middle(){ WIZARD inner(){ YEET a } YEET inner } YEET BONK middle()() }"));
const closureBC=compileBytecode(closureAst);
assert.equal(encodeGBC(closureBC).subarray(0,4).toString("ascii"),"GBC2");
assert.equal(closureBC.functions[0].freeNames?.length??0,0);
assert.equal(closureBC.functions[0].functions[0].freeNames[0],"a");

assert.throws(()=>execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(1)").output,/expected 2 argument/);
assert.throws(()=>execute("OOPSIE «UNHANDLED»"),/UNHANDLED/);
console.log("GLOP BYTECODE VM TESTS PASSED.");
