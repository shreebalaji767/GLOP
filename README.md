# GLOP

GLOP is a real programming language with ridiculous keywords and a serious compiler.

## Pipeline

GLOP source -> Lexer -> Parser -> AST -> Semantic analysis -> Bytecode -> GLOP VM\n\nThe current bootstrap compiler is JavaScript/Node.js. GLOP 0.3 also includes a native C++17 runtime that executes portable `.gbc` bytecode without Node.js.

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

GLOP 0.3 is the native-runtime foundation for a future VM, modules, classes, package manager,
formatter, debugger, REPL and browser playground.
