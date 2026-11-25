---
type: regex
target: {source: file, path: src/pages/usuarios-admin.page.ts}
pattern: 'cadastrarBotao = page\.(getByRole\(.button.|getByTestId\(.salvarUsuario)'
flags: m
match: contains
---
