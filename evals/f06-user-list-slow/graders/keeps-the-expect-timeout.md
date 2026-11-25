---
type: regex
target: {source: file, path: playwright.config.ts}
pattern: 'expect: \{ timeout: 7_?000 \}'
flags: m
match: contains
---
