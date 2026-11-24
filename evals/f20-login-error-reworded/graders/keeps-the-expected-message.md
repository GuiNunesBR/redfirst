---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'message\)\.toBe\(.Email e/ou senha inválidos.\);'
flags: m
match: contains
---
