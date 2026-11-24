---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'test\.(skip|fixme|fail)\('
flags: m
match: not_contains
---
