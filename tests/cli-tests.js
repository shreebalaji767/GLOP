import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const cli = new URL("../src/cli.js", import.meta.url).pathname;

const version = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" }).trim();
assert.equal(version, "GLOP 0.23.0");

const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
assert.ok(help.includes("glop doctor"));
assert.ok(help.includes("glop fmt <file.glop>"));
assert.ok(help.includes("glop lint <file.glop>"));

const doctor = execFileSync(process.execPath, [cli, "doctor"], { encoding: "utf8" });
assert.ok(doctor.includes("GLOP DOCTOR"));
assert.ok(doctor.includes("DIAGNOSIS: GLOP is ready"));

console.log("GLOP CLI TEST PASSED.");
