# GLOP

GLOP is a real programming language with ridiculous keywords and a serious compiler.

## Pipeline

GLOP source -> Lexer -> Parser -> AST -> Semantic analysis -> Bytecode -> GLOP VM\n\nThe current bootstrap compiler is JavaScript/Node.js. GLOP 0.5 also includes a native C++17 runtime that executes portable `.gbc` bytecode without Node.js.

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

GLOP 0.5 is the native-runtime foundation for a future VM, modules, classes, package manager,
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

These are native GLOP runtime functions, not calls into Node.js, Python, or another language runtime.
