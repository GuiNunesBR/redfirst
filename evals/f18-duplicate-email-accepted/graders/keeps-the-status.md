---
type: regex
target: {source: file, path: tests/e2e/cadastro.spec.ts}
pattern: 'expect\(resposta\.status\)\.toBe\(400\);'
flags: m
match: contains
---
