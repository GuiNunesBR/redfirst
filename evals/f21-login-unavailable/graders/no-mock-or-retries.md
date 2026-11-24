---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'page\.route|\.fulfill\(|retries'
flags: m
match: not_contains
---
