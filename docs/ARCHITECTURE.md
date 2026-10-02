# GLOP Architecture

GLOP is being built as a language implementation, not a keyword joke.

Long-term pipeline:

Source -> Lexer -> Parser -> AST -> Semantic analysis -> IR -> Bytecode -> GLOP VM -> Standard library

The JavaScript backend is a bootstrap backend. The long-term runtime is a GLOP-owned bytecode virtual machine.

Compiler layers:
- Lexer: tokens with source locations.
- Parser: AST and syntax validation.
- Semantic analysis: scopes, declarations, undefined names, function signatures, control flow, modules and future static types.
- IR/bytecode: constants, locals/globals, arithmetic, comparisons, jumps, calls, returns, arrays/objects, properties, exceptions, modules and classes.
- VM: owns execution semantics and removes permanent dependence on JavaScript.

GLOP 1.0 targets general-purpose programming: functions, data structures, modules, exceptions, files, networking, process interaction, concurrency primitives, testing, package management and tooling.

A feature is not considered finished merely because the parser accepts its keyword.