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
NEW=construct, THIS=current object.

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
- future class instances
- future iterators

Errors have an error type, message, source location, stack trace and optional cause.

Syntax is not considered stable until its semantics, backend and runtime behavior are covered by tests.