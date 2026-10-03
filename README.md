# GLOP 0.21

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

GLOP=variable, YAP=print, SUS=if, NAH=else, SPIN=while, WIZARD=function, CLASS=class, INIT=constructor, EXTENDS=inheritance, NEW=instance, THIS=receiver,
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

GLOP 0.18 adds anonymous function expressions on top of the existing closure system. You can now create a WIZARD without naming it, store it in a variable, return it from another WIZARD, and call it later.

GLOP 0.17 added a consistent JavaScript CLI version/help interface and keeps the GLOP Inspector plus debugger tooling for source-aware breakpoints, stepping diagnostics, locals, and call-stack reporting. It also retains VM tracing, bytecode verification, the JavaScript/native standard library surface, modules, closures, exceptions, a persistent REPL, GBC3 bytecode with GBC2 compatibility, a disassembler, source locations, and native runtime tooling.


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


## GLOP 0.17 language polish

The lexer now supports:
- block comments: `/* ... */`
- scientific notation such as `1e3`, `2.5E-4`

The JavaScript standard library now also includes:
- `ROUND(x)`
- `RANDOM(max)`
- `JSON_PARSE(text)`
- `JSON_STRINGIFY(value, indent)`
- `IS_NAN(x)`
- `IS_FINITE(x)`

Example:

```glop
/* The computer has been warned. */
GLOP payload = JSON_PARSE(«{"name":"GLOP","power":100}»)
YAP payload.name
YAP ROUND(3.7)
YAP JSON_STRINGIFY(payload, 2)
```
\n\n## GLOP 0.18 anonymous WIZARDs\n\nA WIZARD does not need a name when you want a function value:\n\n```glop\nGLOP add = WIZARD(a, b) {\n    YEET a + b\n}\n\nYAP BONK add(10, 20)\n```\n\nAnonymous WIZARDs are closures, so they can capture surrounding variables:\n\n```glop\nWIZARD makeDoubler(x) {\n    YEET WIZARD(value) {\n        YEET value * x\n    }\n}\n\nGLOP double = BONK makeDoubler(21)\nYAP BONK double(2)\n```\n\nThe bytecode VM and JavaScript compiler both support this feature. Named `WIZARD name(...) { ... }` functions remain unchanged.\n



## GLOP 0.21 classes

GLOP now supports classes, constructors, instances, and methods:

```glop
CLASS Dog {
    INIT(name) {
        THIS.name = name
    }

    WIZARD bark() {
        YEET «BORK » + THIS.name
    }
}

GLOP dog = NEW Dog(«BOB»)
YAP BONK dog.bark()
```

`INIT` runs automatically when `NEW` creates an instance. Methods receive the instance as `THIS`.

## GLOP 0.20 object chaos

Objects can now contain real methods. When a method is called through an object, GLOP binds that object to THIS:

```glop
GLOP dog = {
    name: «BOB»,
    bark: WIZARD() {
        YEET «I AM » + THIS.name + «. BORK.»
    }
}

YAP BONK dog.bark()
```

Method arguments work normally, and the same THIS value is available inside nested closures created by the method. The bytecode VM uses a dedicated method-call instruction so receiver binding is explicit instead of being magical spaghetti.

## GLOP 0.19 standard-library chaos

More absurdly useful builtins are available:

```glop
GLOP nums = [5, 2, 9, 2, 5]

YAP SUM(nums)
YAP AVG(nums)
YAP SORT(nums)
YAP REVERSE(nums)
YAP UNIQUE(nums)

YAP CONTAINS(«banana», «nan»)
YAP STARTS_WITH(«GLOP», «GL»)
YAP ENDS_WITH(«GLOP», «OP»)
YAP PAD_LEFT(«42», 5, «0»)
```

The collection helpers return new arrays, so the original array stays available for further chaos.


## GLOP 0.21 — classes, inheritance, and types

Classes now support constructors, methods, instances, and inheritance:

```glop
CLASS Animal {
    INIT(name) { THIS.name = name }
    WIZARD speak() { YEET THIS.name }
}

CLASS Dog EXTENDS Animal {
    WIZARD bark() { YEET «BORK» }
}

GLOP dog = NEW Dog(«BOB»)
YAP BONK dog.speak()
YAP BONK dog.bark()
```

GLOP also has optional gradual type annotations:

```glop
GLOP count:NUMBER = 10
WIZARD add(a:NUMBER, b:NUMBER):NUMBER {
    YEET a + b
}
YAP BONK add(count, 20)
```

Known types are checked before execution; `ANY` leaves a value dynamically typed.


## GLOP 0.22 — developer experience upgrade

GLOP 0.22 focuses on making the toolchain easier to diagnose and safer to use.

### CLI health check

Run:

```bash
node src/cli.js doctor
```

The doctor checks the Node.js requirement and the core lexer, parser, bytecode VM, package manifest, and native runtime source. It exits non-zero if a required component is missing.

### CLI reliability

The debug and trace paths now keep source text in an explicit module-scoped variable, so diagnostics can safely show source context instead of relying on an undeclared variable.

### Native version consistency

The native executable now reports the same GLOP release version as the JavaScript toolchain: **0.22.0**.

### Test coverage

The default `npm test` suite now includes CLI smoke tests for:

- `--version`
- `--help`
- `doctor`

This makes the command-line surface part of the normal regression suite.

## Upgrade direction

The next language-level milestones can build on the existing compiler/VM foundation:

1. first-class package/dependency management
2. richer source maps and debugger stepping
3. a formatter and linter
4. native bytecode execution parity with the JavaScript VM
5. a standard-library documentation site
6. a self-hosted/native compiler
7. an official GLOP playground
