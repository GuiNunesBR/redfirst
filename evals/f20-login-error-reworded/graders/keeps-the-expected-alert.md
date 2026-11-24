---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'toContainText\(.Email e/ou senha inválidos.\);'
flags: m
match: contains
---
