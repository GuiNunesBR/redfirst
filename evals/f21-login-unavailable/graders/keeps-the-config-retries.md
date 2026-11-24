---
type: regex
target: {source: file, path: playwright.config.ts}
pattern: 'retries: ci \? 1 : 0,'
flags: m
match: contains
---
