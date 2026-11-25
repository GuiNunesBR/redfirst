---
type: regex
target: {source: file, path: tests/e2e/usuarios-admin.spec.ts}
pattern: 'await expect\(linha\)\.toContainText\(usuario\.nome\);'
flags: m
match: contains
---
