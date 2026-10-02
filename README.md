# GLOP

GLOP is a real programming language with ridiculous keywords and a serious compiler.

## Pipeline

GLOP source -> Lexer -> Parser -> AST -> Semantic analysis -> Bytecode -> GLOP VM\n\nThe current bootstrap compiler is JavaScript/Node.js. GLOP also includes a native C++17 runtime that executes portable `.gbc` bytecode without Node.js. The GBC2 format now carries lexical-scope metadata needed for native closures.

## Example

\`\`\`glop
GLOP x = 10
GLOP y = 20
YAP x + y
\`\`\`

Output: \`30\`

## Keywords

GLOP=variable, YAP=print, SUS=if, NAH=else, SPIN=while, WIZARD=function,
BONK=call, YEET=return, BASED=true, CAP=false, VOID=null, OOPSIE=throw,
TRY/CATCH=errors, NOPE=break, ZOOM=continue, STEAL=import, FLEX=export.

## Run

\`\`\`bash
npm test
node src/cli.js run examples/hello.glop
node src/cli.js compile examples/hello.glop\nnode src/cli.js build examples/hello.glop\n\n# Native runtime (after building runtime/native)\n./glop-runtime examples/hello.gbc
\`\`\`

GLOP 0.9 is the module-loader, native-runtime and closure foundation for a future VM, modules, classes, package manager,
formatter, debugger, REPL and browser playground.


## Dependency-free native GLOP

GLOP now has a standalone native executable source at `runtime/native/glop.cpp`.

Build it with a C++17 compiler:

```text
cmake -S runtime/native -B build
cmake --build build --config Release
```

The resulting `glop` executable can run GLOP source directly:

```text
glop hello.glop
```

After the executable is built, running a GLOP program does **not** require Node.js, npm, Python, Java, or another language runtime.

The native frontend/runtime is the first step toward the final self-contained GLOP toolchain. The existing JavaScript compiler remains a bootstrap/development tool while the native compiler and full standard library are expanded.


## Native standard library

The dependency-free native runtime now includes:

- collections: `LEN`, `PUSH`, `POP`
- type/conversion: `TYPE`, `TO_STRING`
- math: `ABS`, `SQRT`, `FLOOR`, `CEIL`
- strings: `SUBSTR`, `UPPER`, `LOWER`
- filesystem: `READ_FILE`, `WRITE_FILE`, `EXISTS`
- collections/conversion: `HAS`, `KEYS`, `RANGE`, `NUMBER`
- system/runtime: `ARGS`, `TIME_MS`, `SLEEP_MS`, `ENV`, `CWD`, `JOIN_PATH`
- math/core: `MIN`, `MAX`, `POW`, `CLAMP`, `ASSERT`
- strings: `REPEAT`, `TRIM`, `REPLACE`, `SPLIT`, `JOIN`
- conversion: `NUMBER`
- source comments: `//` and `/* ... */`

Native examples are part of CI, including the system API and core standard-library smoke tests.

These are native GLOP runtime functions, not calls into Node.js, Python, or another language runtime.


### Native CLI

The standalone executable supports:
- `glop program.glop` — execute a program.
- `glop check program.glop` — lex and parse without executing.
- `glop --version` — print the native runtime version.
- `glop --help` — show usage and built-ins.

This keeps the development toolchain language-owned: a user running the native executable does not need Node.js, Python, Java, or another language runtime.


## Static semantic safety

The JavaScript front-end now performs stronger compile-time checks before bytecode generation:

- inferred primitive/container types: number, string, boolean, null, array, object and function
- boolean-only SUS and SPIN conditions
- numeric-only arithmetic for -, *, / and %
- compatible operands for comparisons
- string + string and number + number for +
- assignment compatibility for known types
- function-call arity validation
- rejection of BONK on known non-function values

The analyzer intentionally keeps unknown for values whose type cannot yet be proven statically. This is a gradual foundation rather than pretending GLOP has a complete static type system already.


## Modules

GLOP 0.9 adds real source-module loading to the bytecode VM.

Import a module with an explicit alias:

```glop
STEAL "./math.glop" AS math
YAP BONK math.add(10)
```

Export selected module-level names:

```glop
GLOP base = 10

WIZARD add(x) {
    YEET x + base
}

FLEX add, base
```

Module behavior:
- imports resolve relative to the importing `.glop` file
- `.glop` is added automatically when omitted
- modules are canonicalized and cached, so a module executes once per loader
- circular imports are detected with a module-chain diagnostic
- `FLEX` validates exported names before execution
- module scope is isolated; exported GLOP functions retain the globals of their defining module
- `glop run` uses the module loader
- the bootstrap JavaScript compiler intentionally rejects `STEAL/FLEX`
- native `.gbc` bundling of multi-file modules is not enabled yet; `glop build` rejects module programs instead of producing a misleading artifact

The module system is deliberately path-based now; a package registry and dependency manager can build on this resolver later.
