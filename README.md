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
TRY/CATCH=errors, NOPE=break, ZOOM=continue.

## Run

\`\`\`bash
npm test
node src/cli.js run examples/hello.glop
node src/cli.js compile examples/hello.glop\nnode src/cli.js build examples/hello.glop\n\n# Native runtime (after building runtime/native)\n./glop-runtime examples/hello.gbc
\`\`\`

GLOP 0.8 is the native-runtime and closure foundation for a future VM, modules, classes, package manager,
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
