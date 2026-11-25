---
type: regex
target: {source: file, path: tests/e2e/cadastro.spec.ts}
pattern: '\.route\(|route\.fulfill|routeFromHAR'
flags: m
match: not_contains
---
