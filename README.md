# GLOP 0.16

GLOP is a real programming language with ridiculous keywords and a serious compiler.

## Pipeline

GLOP source -> Lexer -> Parser -> AST -> Semantic analysis -> Bytecode -> GLOP VM

The current bootstrap compiler is JavaScript/Node.js. GLOP also includes a native C++17 runtime that executes portable `.gbc` bytecode without Node.js. The GBC3 is the current portable bytecode format and carries source locations; the reader remains backward-compatible with GBC2.

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
node src/cli.js compile examples/hello.glop
node src/cli.js build examples/hello.glop

# Native runtime (after building runtime/native)
./glop-runtime examples/hello.gbc
\`\`\`

GLOP 0.16 adds a consistent JavaScript CLI version/help interface and keeps the GLOP Inspector plus debugger tooling for source-aware breakpoints, stepping diagnostics, locals, and call-stack reporting. It also retains VM tracing, bytecode verification, the JavaScript/native standard library surface, modules, closures, exceptions, a persistent REPL, GBC3 bytecode with GBC2 compatibility, a disassembler, source locations, and native runtime tooling.


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


## Portable JavaScript standard library

The bytecode VM exposes the same core library surface used by native GLOP programs, including collections, math, strings, conversion, filesystem, environment, process arguments, timing, and assertions:

```glop
GLOP values = RANGE(1, 6)
YAP LEN(values)
YAP JOIN(SPLIT(«GLOP IS CHAOS», « »), «-»)
YAP SQRT(144)
```

The standard-library implementation lives in `src/stdlib.js`, keeping the bootstrap VM independent from the native C++ implementation while preserving the same language-level names.

## Bytecode inspection

Inspect compiled bytecode directly:

```text
glop dump program.glop
glop dump program.gbc
glop build program.glop -o program.gbc
glop run program.gbc
glop trace program.glop
glop trace program.gbc
```

The disassembler shows function metadata, closure/free-variable metadata, locals, constants, instruction offsets, opcodes, and operands.


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

GLOP 0.9 added real source-module loading to the bytecode VM.

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
- `glop build` recursively bundles `STEAL/FLEX` programs into one portable GBC2 artifact
- dependency modules are initialized once in dependency-before-dependent order
- module-local variables become isolated factory locals and exported functions retain their closures
- circular imports are rejected during bundling

The module system is deliberately path-based now; a package registry and dependency manager can build on this resolver later.


## REPL

GLOP now has a persistent interactive shell:

```text
glop repl
GLOP> GLOP x = 10
GLOP> YAP x + 5
15
GLOP> WIZARD add(a,b) {
...   YEET a + b
... }
GLOP> YAP BONK add(2,3)
5
```

The REPL keeps its global environment between submissions, understands multi-line blocks, and supports `.help`, `.clear`, and `.exit`.


## Source-aware debugging

Use the debugger to inspect execution without changing the program:

```text
glop debug program.glop --break 3
glop debug program.glop --step
glop debug program.gbc --break 3
```

Debugger output includes the current function, source line/column, bytecode offset, opcode, locals when available, and call-stack context. `--step` enables instruction-level debug reporting and `--break N` reports execution at source line `N`.



GLOP bytecode now carries source line/column metadata. The VM trace reports the function, source position, bytecode offset, opcode, operand, and stack depth. `GBC3` is the current format; the reader remains compatible with legacy `GBC2` files.
