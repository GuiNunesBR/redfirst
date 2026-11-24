---
type: regex
target: {source: file, path: src/pages/produtos.page.ts}
pattern: 'waitForResponse|waitForTimeout|waitForLoadState|timeout'
flags: m
match: not_contains
---
