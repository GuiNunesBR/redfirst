---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'toContainText\(`Bem Vindo \$\{admin\.nome\}`\)'
flags: m
match: contains
---
