import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addDependency,
  findProject,
  initProject,
  installProject,
  parseManifest,
  removeDependency,
  stringifyManifest
} from "../src/project.js";

const parsed = parseManifest(`[package]
name = "demo"
version = "1.2.3"
entry = "main.glop"

[dependencies]
util = "../util"
`);
assert.equal(parsed.package.name, "demo");
assert.equal(parsed.dependencies.util, "../util");
assert.match(stringifyManifest(parsed), /name = "demo"/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "glop-project-"));
const app = path.join(root, "app");
const dep = path.join(root, "dep");
initProject(app);
initProject(dep);
assert.equal(findProject(path.join(app, "tests")), app);
addDependency(app, "dep", "../dep");
const lock = installProject(app);
assert.equal(lock.dependencies.dep.resolved, "../dep");
removeDependency(app, "dep");
assert.deepEqual(parseManifest(fs.readFileSync(path.join(app, "glop.toml"), "utf8")).dependencies, {});

console.log("GLOP PROJECT TESTS PASSED.");
