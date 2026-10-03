import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";
import { encodeGBC, decodeGBC } from "../src/gbc.js";

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
assert.deepEqual(execute("GLOP nums=[5,2,9,2] YAP SUM(nums) YAP AVG(nums) YAP SORT(nums) YAP REVERSE(nums) YAP UNIQUE(nums)").output,[18,4.5,[2,2,5,9],[2,9,2,5],[5,2,9]]);
assert.deepEqual(execute("YAP CONTAINS(«banana»,«nan») YAP STARTS_WITH(«GLOP»,«GL») YAP ENDS_WITH(«GLOP»,«OP») YAP PAD_LEFT(«42»,5,«0»)").output,[true,true,true,"00042"]);
assert.deepEqual(execute("GLOP dog={name:«BOB»,bark:WIZARD(){ YEET THIS.name }} YAP BONK dog.bark()").output,["BOB"]);
assert.deepEqual(execute("GLOP dog={name:«BOB»,say:WIZARD(word){ YEET THIS.name+word }} YAP BONK dog.say(«! »)").output,["BOB! "]);
assert.deepEqual(execute("GLOP dog={name:«BOB»,make:WIZARD(){ WIZARD inner(){ YEET THIS.name } YEET inner }} GLOP f=BONK dog.make() YAP BONK f()").output,["BOB"]);
assert.deepEqual(execute("CLASS Dog { INIT(name){ THIS.name=name } WIZARD bark(){ YEET «BORK »+THIS.name } } GLOP dog=NEW Dog(«BOB») YAP BONK dog.bark()").output,["BORK BOB"]);
assert.deepEqual(execute("CLASS Box { INIT(x){ THIS.x=x } WIZARD add(y){ THIS.x=THIS.x+y YEET THIS.x } } GLOP b=NEW Box(10) YAP BONK b.add(5) YAP BONK b.add(7)").output,[15,22]);
assert.deepEqual(execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(10,20)").output,[30]);
assert.deepEqual(execute("GLOP add=WIZARD(a,b){ YEET a+b } YAP BONK add(10,20)").output,[30]);
assert.deepEqual(execute("GLOP make=WIZARD(x){ WIZARD inner(){ YEET x*2 } YEET inner } GLOP f=BONK make(21) YAP BONK f()").output,[42]);
assert.deepEqual(execute("WIZARD square(x){ YEET x*x } YAP BONK square(7)").output,[49]);
assert.deepEqual(execute("WIZARD fact(n){ SUS n<=1 { YEET 1 } YEET n*BONK fact(n-1) } YAP BONK fact(5)").output,[120]);

assert.deepEqual(execute("WIZARD makeCounter(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } YEET inc } GLOP counter=BONK makeCounter(10) YAP BONK counter() YAP BONK counter()").output,[11,12]);
assert.deepEqual(execute("WIZARD outer(a){ WIZARD middle(){ WIZARD inner(){ YEET a } YEET inner } YEET BONK middle()() } YAP BONK outer(42)").output,[42]);
assert.deepEqual(execute("WIZARD makePair(start){ GLOP x=start WIZARD inc(){ x+=1 YEET x } WIZARD read(){ YEET x } YEET inc } GLOP f=BONK makePair(3) YAP BONK f() YAP BONK f()").output,[4,5]);
const closureAst=parse(lex("WIZARD outer(a){ WIZARD middle(){ WIZARD inner(){ YEET a } YEET inner } YEET BONK middle()() }"));
const closureBC=compileBytecode(closureAst);
assert.equal(encodeGBC(closureBC).subarray(0,4).toString("ascii"),"GBC3");
assert.equal(closureBC.functions[0].freeNames?.length??0,0);
assert.equal(closureBC.functions[0].functions[0].freeNames[0],"a");
const roundTrip = decodeGBC(encodeGBC(closureBC));
const roundTripOutput=[];
assert.equal(runBytecode(roundTrip,{output:value=>roundTripOutput.push(value)}),null);
assert.deepEqual(roundTripOutput,[]);
const simple = compileBytecode(parse(lex("GLOP x=21 YAP x*2")));
const simpleRoundTripOutput=[];
assert.equal(runBytecode(decodeGBC(encodeGBC(simple)),{output:value=>simpleRoundTripOutput.push(value)}),null);
assert.deepEqual(simpleRoundTripOutput,[42]);
assert.ok(decodeGBC(encodeGBC(closureBC)).code.some(ins=>ins.loc));
assert.throws(()=>decodeGBC(Buffer.from("NOPE")),/unsupported or corrupt magic/);

assert.throws(()=>execute("WIZARD add(a,b){ YEET a+b } YAP BONK add(1)").output,/expected 2 argument/);
assert.throws(()=>execute("OOPSIE «UNHANDLED»"),/UNHANDLED/);
console.log("GLOP BYTECODE VM TESTS PASSED.");
