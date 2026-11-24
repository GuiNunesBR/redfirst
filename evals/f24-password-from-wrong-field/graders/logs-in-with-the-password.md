---
type: regex
target: {source: file, path: tests/e2e/login.spec.ts}
pattern: 'capturarApi\(.POST., ./login., \(\) => login\.entrar\(admin\.email, admin\.password\)\)'
flags: m
match: contains
---
