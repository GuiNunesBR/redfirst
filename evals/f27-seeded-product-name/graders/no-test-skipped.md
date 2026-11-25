---
type: regex
target: {source: file, path: tests/api/produtos.spec.ts}
pattern: 'test\.(skip|fixme|fail)\('
flags: m
match: not_contains
---
