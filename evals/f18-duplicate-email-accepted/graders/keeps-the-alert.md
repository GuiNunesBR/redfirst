---
type: regex
target: {source: file, path: tests/e2e/cadastro.spec.ts}
pattern: 'await expect\(cadastro\.alerta\)\.toContainText\(.Este email já está sendo usado.\);'
flags: m
match: contains
---
