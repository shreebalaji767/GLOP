import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModuleLoader, GlopModuleError } from "../src/module-loader.js";

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"glop-modules-"));
const write=(name,source)=>fs.writeFileSync(path.join(dir,name),source);

write("math.glop",`GLOP secret = 40
WIZARD add(x) {
  YEET x + secret
}
FLEX add, secret
`);
write("once.glop",`GLOP runs = 0
runs += 1
WIZARD getRuns() { YEET runs }
FLEX getRuns
`);
write("nested.glop",`STEAL "./math.glop" AS math
WIZARD twice(x) { YEET BONK math.add(x) + 2 }
FLEX twice
`);
write("build-main.glop",`STEAL "./nested.glop" AS nested\nYAP BONK nested.twice(3)\n`);

write("main.glop",`STEAL "./math.glop" AS math
STEAL "./once.glop" AS once
STEAL "./nested.glop" AS nested
YAP BONK math.add(2)
YAP BONK once.getRuns()
YAP BONK nested.twice(3)
YAP BONK once.getRuns()
`);

const output=[];
new ModuleLoader({output:value=>output.push(value)}).runEntry(path.join(dir,"main.glop"));
assert.deepEqual(output,[42,1,45,1]);

const loader=new ModuleLoader({output:()=>{}});
const first=loader.load(path.join(dir,"once.glop"));
const second=loader.load(path.join(dir,"once.glop"));
assert.strictEqual(first,second);

write("bad.glop",`STEAL "./missing.glop" AS nope`);
assert.throws(()=>new ModuleLoader().runEntry(path.join(dir,"bad.glop")),e=>e instanceof GlopModuleError&&e.code==="MODULE_NOT_FOUND");

write("a.glop",`STEAL "./b.glop" AS b`);
write("b.glop",`STEAL "./a.glop" AS a`);
assert.throws(()=>new ModuleLoader().runEntry(path.join(dir,"a.glop")),e=>e instanceof GlopModuleError&&e.code==="MODULE_CYCLE");

write("invalid-export.glop",`FLEX nope`);
assert.throws(()=>new ModuleLoader().runEntry(path.join(dir,"invalid-export.glop")),/Cannot FLEX undefined name/);

const { bundleModules } = await import("../src/module-bundler.js");
const { compileBytecode } = await import("../src/bytecode-compiler.js");
const { runBytecode } = await import("../src/vm.js");
const bundledOutput=[];
const bundled = bundleModules(path.join(dir,"build-main.glop"));
runBytecode(compileBytecode(bundled.ast), { output:value=>bundledOutput.push(value) });
assert.deepEqual(bundledOutput,[45]);
assert.equal(bundled.modules.length,3);
assert.throws(()=>bundleModules(path.join(dir,"a.glop")),e=>e.code==="MODULE_CYCLE");

console.log("GLOP MODULE TESTS PASSED.");
