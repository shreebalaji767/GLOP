import fs from "node:fs";
import path from "node:path";

export const MANIFEST = "glop.toml";
export const LOCKFILE = "glop.lock";

export class GlopProjectError extends Error {
  constructor(message, code = "PROJECT_ERROR") {
    super(`GLOP PROJECT OOPSIE: ${message}`);
    this.name = "GlopProjectError";
    this.code = code;
  }
}

const quote = value => JSON.stringify(String(value));

export function parseManifest(text) {
  const result = { package: {}, dependencies: {}, scripts: {} };
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      section = header[1].trim();
      if (!["package", "dependencies", "scripts"].includes(section))
        throw new GlopProjectError(`unsupported manifest section [${section}]`, "MANIFEST_SECTION");
      continue;
    }
    const pair = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (!pair || !section) throw new GlopProjectError(`invalid manifest line: ${raw}`, "MANIFEST_SYNTAX");
    const [, key, rawValue] = pair;
    let value;
    try {
      if (rawValue.startsWith('"')) value = JSON.parse(rawValue);
      else if (rawValue === "true" || rawValue === "false") value = rawValue === "true";
      else if (/^-?\d+(\.\d+)?$/.test(rawValue)) value = Number(rawValue);
      else throw new Error();
    } catch {
      throw new GlopProjectError(`invalid value for ${key}: ${rawValue}`, "MANIFEST_VALUE");
    }
    result[section][key] = value;
  }
  if (!result.package.name) throw new GlopProjectError('missing [package] name', "MANIFEST_PACKAGE");
  if (!result.package.version) throw new GlopProjectError('missing [package] version', "MANIFEST_PACKAGE");
  result.package.entry ??= "main.glop";
  return result;
}

export function stringifyManifest(manifest) {
  const lines = [
    "# GLOP project manifest",
    "",
    "[package]",
    `name = ${quote(manifest.package.name)}`,
    `version = ${quote(manifest.package.version)}`,
    `entry = ${quote(manifest.package.entry ?? "main.glop")}`,
    "",
    "[dependencies]"
  ];
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {}).sort())
    lines.push(`${name} = ${quote(spec)}`);
  if (Object.keys(manifest.scripts ?? {}).length) {
    lines.push("", "[scripts]");
    for (const [name, command] of Object.entries(manifest.scripts).sort())
      lines.push(`${name} = ${quote(command)}`);
  }
  return lines.join("\n") + "\n";
}

export function findProject(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    const manifest = path.join(current, MANIFEST);
    if (fs.existsSync(manifest)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function readProject(root) {
  const projectRoot = path.resolve(root);
  const manifestPath = path.join(projectRoot, MANIFEST);
  if (!fs.existsSync(manifestPath)) throw new GlopProjectError(`no ${MANIFEST} found in ${projectRoot}`, "PROJECT_NOT_FOUND");
  return { root: projectRoot, manifestPath, manifest: parseManifest(fs.readFileSync(manifestPath, "utf8")) };
}

export function writeLockfile(root, manifest) {
  const entries = {};
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {}).sort()) {
    const absolute = path.resolve(root, spec);
    entries[name] = { spec, resolved: path.relative(root, absolute) || "." };
  }
  const lock = { lockfileVersion: 1, package: manifest.package.name, dependencies: entries };
  fs.writeFileSync(path.join(root, LOCKFILE), JSON.stringify(lock, null, 2) + "\n");
  return lock;
}

export function validateDependencies(root, manifest) {
  const errors = [];
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (typeof spec !== "string" || (!spec.startsWith("./") && !spec.startsWith("../") && !path.isAbsolute(spec))) {
      errors.push(`${name}: only local path dependencies are supported currently (${spec})`);
      continue;
    }
    const resolved = path.resolve(root, spec);
    const manifestPath = path.join(resolved, MANIFEST);
    if (!fs.existsSync(manifestPath)) errors.push(`${name}: dependency project not found at ${resolved}`);
    else {
      try { readProject(resolved); } catch (e) { errors.push(`${name}: ${e.message}`); }
    }
  }
  return errors;
}

export function initProject(directory = ".") {
  const root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true });
  const manifestPath = path.join(root, MANIFEST);
  if (fs.existsSync(manifestPath)) throw new GlopProjectError(`${MANIFEST} already exists in ${root}`, "MANIFEST_EXISTS");
  const name = path.basename(root) || "glop-project";
  const manifest = { package: { name, version: "0.1.0", entry: "main.glop" }, dependencies: {}, scripts: {} };
  fs.writeFileSync(manifestPath, stringifyManifest(manifest));
  const entry = path.join(root, "main.glop");
  if (!fs.existsSync(entry)) fs.writeFileSync(entry, 'YAP «HELLO FROM GLOP»\n');
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  writeLockfile(root, manifest);
  return { root, manifest };
}

export function addDependency(root, name, spec) {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw new GlopProjectError(`invalid dependency name: ${name}`, "DEPENDENCY_NAME");
  const project = readProject(root);
  if (!spec) throw new GlopProjectError("missing dependency path", "DEPENDENCY_PATH");
  if (!spec.startsWith("./") && !spec.startsWith("../") && !path.isAbsolute(spec))
    throw new GlopProjectError("GLOP 0.24 currently accepts local path dependencies only", "DEPENDENCY_SOURCE");
  const resolved = path.resolve(project.root, spec);
  if (!fs.existsSync(resolved)) throw new GlopProjectError(`dependency path does not exist: ${resolved}`, "DEPENDENCY_NOT_FOUND");
  project.manifest.dependencies[name] = path.relative(project.root, resolved) || ".";
  fs.writeFileSync(project.manifestPath, stringifyManifest(project.manifest));
  return project.manifest.dependencies[name];
}

export function removeDependency(root, name) {
  const project = readProject(root);
  if (!Object.prototype.hasOwnProperty.call(project.manifest.dependencies, name))
    throw new GlopProjectError(`dependency not found: ${name}`, "DEPENDENCY_NOT_FOUND");
  delete project.manifest.dependencies[name];
  fs.writeFileSync(project.manifestPath, stringifyManifest(project.manifest));
}

export function installProject(root) {
  const project = readProject(root);
  const errors = validateDependencies(project.root, project.manifest);
  if (errors.length) throw new GlopProjectError(errors.join("\n"), "DEPENDENCY_INVALID");
  return writeLockfile(project.root, project.manifest);
}
