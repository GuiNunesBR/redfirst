---
type: regex
target: {source: file, path: tests/e2e/produtos-admin.spec.ts}
pattern: 'await expect\(listagem\.linhaDe\(produto\.nome\)\)\.toBeVisible\(\);'
flags: m
match: contains
---
