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

## VM control flow and functions (0.2.x)

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