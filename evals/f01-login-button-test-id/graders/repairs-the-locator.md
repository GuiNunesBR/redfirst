---
type: regex
target: {source: file, path: src/pages/login.page.ts}
pattern: 'entrarBotao = page\.(getByRole\(.button.|getByTestId\(.btn-entrar)'
flags: m
match: contains
---
