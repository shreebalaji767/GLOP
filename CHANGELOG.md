# Changelog

## 0.20.0 — object chaos

- Added receiver-aware object method calls with `BONK object.method(...)`.
- Added `THIS` inside WIZARD functions so methods can read and update their receiver.
- Added bytecode VM support for bound method calls and verifier stack validation.
- Added regression tests for object methods, method arguments, and `THIS`.


## 0.19.0 — standard-library chaos

- Added numeric helpers for sums and averages.
- Added collection helpers for sorting, reversing, and removing duplicates.
- Added string helpers for containment, prefix/suffix checks, and padding.
- Added runtime type inspection for common GLOP values.


## 0.18.0 — function chaos

- Added anonymous function expressions with `WIZARD(...) { ... }`.
- Anonymous functions are real closures and can be stored in variables, returned from functions, and called with `BONK`.
- Added semantic-analysis, JavaScript compiler, and bytecode VM coverage.


## 0.17.0 — language polish

- Added `/* ... */` block comments.
- Added scientific-notation number literals.
- Added `ROUND`, `RANDOM`, `JSON_PARSE`, `JSON_STRINGIFY`, `IS_NAN`, and `IS_FINITE` to the JavaScript standard library.
- Added lexer regression tests for the new syntax.


## 0.16.0 — CLI polish

- Added `glop --version`, `glop -v`, and `glop version`.
- Added `glop --help`, `glop -h`, and `glop help`.
- CLI help now reports the same version as the package.
- Updated README and package metadata to 0.16.0.
- No language syntax or bytecode format changes in this release.
