# GLOP Language Specification — Draft

Design goals:
1. General-purpose language.
2. Compact syntax.
3. Absurd keyword vocabulary without sentence-like English syntax.
4. Deterministic semantics.
5. Useful compiler and runtime diagnostics.
6. A language-owned runtime rather than permanent dependence on JavaScript.

Core keywords:
GLOP=variable, YAP=print, SUS=if, NAH=else, SPIN=while, WIZARD=function,
BONK=call, YEET=return, BASED=true, CAP=false, VOID=null, OOPSIE=raise,
TRY/CATCH=exceptions, NOPE=break, ZOOM=continue, STEAL=import, FLEX=export,
NEW=construct, THIS=current object, SUPER=parent-method dispatch, INSTANCEOF=inheritance check, OOPS=class declaration, EXTENDS=inheritance.

Core values:
- integers
- floating-point numbers
- booleans
- strings
- null
- arrays
- maps/objects
- functions
- native functions
- classes and class instances
- future iterators

Errors have an error type, message, source location, stack trace and optional cause.

Syntax is not considered stable until its semantics, backend and runtime behavior are covered by tests.
## Object-oriented programming

GLOP supports class-based OOPS programming with deliberately absurd keywords while keeping conventional object semantics.

```glop
OOPS Person {
    WIZARD init(name) {
        THIS.name = name
    }

    WIZARD greet() {
        YEET "HELLO " + THIS.name
    }
}

GLOP person = NEW Person("RAVI")
YAP BONK person.greet()
```

- `OOPS Name { ... }` declares a class.
- `WIZARD init(...)` is the optional constructor.
- `NEW Name(...)` creates an instance.
- `THIS.field` accesses the current instance.
- `WIZARD method(...)` declares an instance method.
- Method calls bind `THIS` automatically.
- `OOPS Child EXTENDS Parent { ... }` creates single inheritance; inherited methods remain available unless overridden.
- `SUPER.method(...)` dispatches directly to the parent implementation while keeping the same `THIS` instance.
- `SUPER.init(...)` may be used by a child constructor to invoke the parent constructor.
- `INSTANCEOF(value, ClassName)` returns `BASED` when an instance belongs to that class or one of its descendants.
- A class may override an inherited method; `SUPER` is the explicit escape hatch to the parent implementation.

Example inheritance:

```glop
OOPS Employee EXTENDS Person {
    WIZARD init(name, role) {
        SUPER.init(name)
        THIS.role = role
    }

    WIZARD greet() {
        YEET SUPER.greet() + " — " + THIS.role
    }
}

GLOP worker = NEW Employee("AMAN", "ENGINEER")
YAP worker.greet()
YAP INSTANCEOF(worker, Employee)
YAP INSTANCEOF(worker, Person)
```


## Modules

Module declarations are currently file-scoped and path-based.

Import:
```glop
STEAL "./math.glop" AS math
YAP BONK math.add(2)
```

Export:
```glop
GLOP base = 40
WIZARD add(x) {
    YEET x + base
}
FLEX add, base
```

Rules:
- `STEAL "path" AS alias` is allowed only at module scope.
- Relative `./` and `../` paths are resolved from the importing file.
- Missing `.glop` extensions are added automatically.
- Bare package names are reserved for a future package manager.
- `FLEX name, ...` exports existing module-level declarations.
- Module loading is cached by canonical path.
- Circular dependency chains are rejected.
- Each module has its own global environment.
- Functions exported from a module retain that module's global environment, so module-private state remains attached to the defining module.
- The current export object is a snapshot of exported bindings at module completion; live ES-module-style bindings are a future semantic upgrade.
- `glop build` recursively bundles multi-file `STEAL/FLEX` programs into one GBC2 file. Dependencies are initialized once in dependency-before-dependent order, each module receives imported namespaces as factory parameters, and exported functions retain captured module state. Circular imports are rejected during bundling.


## Interactive execution

The reference CLI provides a persistent REPL. Each submission is lexed, parsed, semantically analyzed, compiled to bytecode, and executed. Global bindings remain available to later submissions.
