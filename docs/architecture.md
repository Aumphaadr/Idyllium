# Architecture

IdylliumNext is split into editor-neutral layers.

## Core

`src/core` contains source diagnostics, lexing, parsing, AST definitions, semantic analysis, type rules, code generation, and the standard-library registry. It must not depend on VS Code, DOM APIs, Monaco, or Node-only APIs.

## Runtime

`src/runtime` executes generated JavaScript against a small runtime interface. Browser, Node, VS Code WebView, and future GUI/Canvas runtimes can provide different backends for the same language semantics.

## Language Services

`src/language` exposes editor features such as completions. These services read the same AST, semantic model, and standard-library registry used by the compiler.

## Standard Library Registry

The registry is the single source of truth for built-in modules and functions. Adding a method to `math`, `console`, `gui`, or future `canvas` should eventually update:

- semantic checks;
- completion lists;
- signature help;
- hover text;
- runtime bindings;
- generated documentation.

from one declarative description.
