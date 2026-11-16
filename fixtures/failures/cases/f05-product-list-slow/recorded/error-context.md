# Test info

- Name: e2e/produtos-admin.spec.ts >> UI · Produtos (admin) >> exclui um produto pela listagem
- Location: tests/e2e/produtos-admin.spec.ts:32:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('row').filter({ hasText: 'Produto mwjaoryxsnmf' })
Expected: visible
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('row').filter({ hasText: 'Produto mwjaoryxsnmf' }) with timeout 7000ms
  - waiting for getByRole('row').filter({ hasText: 'Produto mwjaoryxsnmf' })

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
- heading "Lista dos Produtos" [level=1]
- separator
- paragraph:
  - table:
    - rowgroup:
      - row "Nome Preço Descrição Quantidade Imagem Ações":
        - columnheader "Nome"
        - columnheader "Preço"
        - columnheader "Descrição"
        - columnheader "Quantidade"
        - columnheader "Imagem"
        - columnheader "Ações"
    - rowgroup
```
