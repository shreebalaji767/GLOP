# GLOP Architecture

GLOP is being built as a language implementation, not a keyword joke.

Long-term pipeline:

Source -> Lexer -> Parser -> AST -> Semantic analysis -> IR -> Bytecode -> GLOP VM -> Standard library

The JavaScript backend is a bootstrap backend. The long-term runtime is a GLOP-owned bytecode virtual machine. GLOP 0.3 adds the first native runtime foundation: a C++17 VM executable that can load the portable GBC1 bytecode format. Node.js remains the bootstrap compiler during this transition; it is not the target execution dependency.

Compiler layers:
- Lexer: tokens with source locations.
- Parser: AST and syntax validation.
- Semantic analysis: scopes, declarations, undefined names, function signatures, control flow, modules and future static types.
- IR/bytecode: constants, locals/globals, arithmetic, comparisons, jumps, calls, returns, arrays/objects, properties, exceptions, modules and classes.
- VM: owns execution semantics and removes permanent dependence on JavaScript.

GLOP 1.0 targets general-purpose programming: functions, data structures, modules, exceptions, files, networking, process interaction, concurrency primitives, testing, package management and tooling.

A feature is not considered finished merely because the parser accepts its keyword.

## Native runtime (0.3.x)\n\nThe repository now contains `runtime/native/glop-runtime.cpp`, a C++17 GLOP VM foundation, plus `runtime/native/CMakeLists.txt`. The JavaScript bytecode compiler can emit the portable `.gbc` format with `glop build`.\n\nCurrent native runtime coverage: constants, globals, locals, function calls/returns, arithmetic, comparisons, jumps, logical short-circuit opcodes, printing and arrays. Closures/upvalues, objects, exceptions and the full standard library are intentionally the next native-runtime milestones.\n\nExample workflow:\n\n```text\nGLOP source -> Node bootstrap compiler -> .gbc -> glop-runtime -> OS\n```\n\nThe native milestone now includes a standalone `glop` executable that lexes, parses and executes `.glop` source directly. This is the dependency-free execution path: once built, the executable needs no Node.js, Python, Java or GLOP-specific external runtime. The existing C++ bytecode VM remains useful for the eventual native compiler/bytecode path.\n\n## VM control flow and functions (0.2.x)

The bytecode VM now has real function call frames and structured loop control.

- Top-level WIZARD declarations are hoisted by the bytecode compiler, allowing functions to call other top-level functions regardless of declaration order.
- CALL creates a VM frame containing the caller chunk, instruction pointer and locals.
- RETURN restores the caller frame and transfers the return value.
- Function parameters and local variables use numeric local slots.
- SPIN compiles to a condition jump plus a backward jump.
- NOPE records a patched jump to the end of the active loop.
- ZOOM jumps to the active loop condition.
- Recursive function calls use the same frame mechanism as ordinary calls.

This is still deliberately below the level required for a mature language: closures/upvalues, heap objects, exceptions, arrays/objects, modules and garbage collection remain separate VM milestones.
\n

## Lexical closures (0.2.x)

GLOP functions now support lexical closures in the bytecode VM.

- Function chunks record captured names and local-slot metadata.
- Local variables live in heap-stable GlopCell objects so a returned closure can outlive its creating call frame.
- LOAD_FREE and STORE_FREE access captured cells.
- MAKE_CLOSURE creates a function value with the cells required by its lexical environment.
- Nested closures can capture through multiple function levels.
- Captured assignment is shared: updating a variable through one closure is visible to other closures sharing that cell.
- Nested function declarations are stored in local slots and can recursively reference themselves.

The implementation uses cells/upvalues rather than copying captured values. This is the foundation required for higher-order functions, callbacks and later garbage-collected heap objects.
\n