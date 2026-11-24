---
type: regex
target: {source: file, path: tests/api/usuarios.spec.ts}
pattern: 'const corpo = validar\(CadastroSchema, await resposta\.json\(\)\);'
flags: m
match: contains
---
