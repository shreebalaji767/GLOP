import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { runBytecode } from "../src/vm.js";

const run=source=>{const out=[];runBytecode(compileBytecode(parse(lex(source))),{output:x=>out.push(x)});return out};
assert.deepEqual(run("YAP LEN([1,2,3]) YAP ABS(7) YAP UPPER(«glop»)"),[3,7,"GLOP"]);
assert.deepEqual(run("YAP RANGE(2,6)"),[[2,3,4,5]]);
assert.deepEqual(run("GLOP a=[1] PUSH(a,2) YAP LEN(a) YAP POP(a) YAP LEN(a)"),[2,2,1]);
assert.deepEqual(run("YAP JOIN([«a»,«b»,«c»], «-»)"),["a-b-c"]);
assert.deepEqual(run("YAP TYPE([1]) YAP TYPE(10) YAP TYPE(BASED)"),["array","number","boolean"]);
console.log("GLOP STANDARD LIBRARY TESTS PASSED.");
