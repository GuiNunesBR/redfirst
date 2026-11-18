# Test info

- Name: e2e/usuarios-admin.spec.ts >> UI · Usuários (admin) >> cadastra um cliente pelo painel e o encontra na listagem
- Location: tests/e2e/usuarios-admin.spec.ts:8:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('row').filter({ hasText: 'qa.mwmhqjcnkmrg@teste.com' })
Expected substring: "Sarah Miller"
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('row').filter({ hasText: 'qa.mwmhqjcnkmrg@teste.com' }) with timeout 7000ms
  - waiting for getByRole('row').filter({ hasText: 'qa.mwmhqjcnkmrg@teste.com' })

```

```yaml
- navigation:
  - img
  - list:
    - listitem: Home
    - listitem: Cadastrar Usuários
    - listitem: Listar Usuários
    - listitem: Cadastrar Produtos
    - listitem: Listar Produtos
    - listitem: Relatórios
  - button "Logout"
- heading "Lista dos usuários" [level=1]
- separator
- paragraph:
  - table:
    - rowgroup:
      - row "Nome Email Senha Administrador Ações":
        - columnheader "Nome"
        - columnheader "Email"
        - columnheader "Senha"
        - columnheader "Administrador"
        - columnheader "Ações"
    - rowgroup
```
