---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'expect\(resposta\.status\)\.toBe\(200\);'
flags: m
match: contains
---
