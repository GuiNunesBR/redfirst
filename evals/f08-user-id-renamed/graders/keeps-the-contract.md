---
type: regex
target: {source: file, path: src/api/schemas.ts}
pattern: 'export const CadastroSchema = z\.object\(\{\s+message: z\.string\(\),\s+_id: z\.string\(\)\.min\(1\),\s+\}\);'
flags: m
match: contains
---
