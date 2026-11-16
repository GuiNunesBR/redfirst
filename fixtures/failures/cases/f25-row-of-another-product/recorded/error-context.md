# Test info

- Name: e2e/produtos-admin.spec.ts >> UI · Produtos (admin) >> exclui um produto pela listagem
- Location: tests/e2e/produtos-admin.spec.ts:32:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('row').filter({ hasText: 'Produto mwjar9w474o8' })
Expected: visible
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('row').filter({ hasText: 'Produto mwjar9w474o8' }) with timeout 7000ms
  - waiting for getByRole('row').filter({ hasText: 'Produto mwjar9w474o8' })

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
    - rowgroup:
      - row "Logitech MX Vertical 470 Mouse 384 Editar Excluir":
        - cell "Logitech MX Vertical"
        - cell "470"
        - cell "Mouse"
        - cell "384"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Combo Teclado e Mouse Sem Fio Logitech MK250 160 Combo Teclado e Mouse 179 Editar Excluir":
        - cell "Combo Teclado e Mouse Sem Fio Logitech MK250"
        - cell "160"
        - cell "Combo Teclado e Mouse"
        - cell "179"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Samsung 60 polegadas 5240 TV 49978 Editar Excluir":
        - cell "Samsung 60 polegadas"
        - cell "5240"
        - cell "TV"
        - cell "49978"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "NOTA NA A3 10000 1 ponto a mais na A3 de GQS 1 Editar Excluir":
        - cell "NOTA NA A3"
        - cell "10000"
        - cell "1 ponto a mais na A3 de GQS"
        - cell "1"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Garrafa de Café 1000 Garrafa de Café 5 Editar Excluir":
        - cell "Garrafa de Café"
        - cell "1000"
        - cell "Garrafa de Café"
        - cell "5"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Produto mwjar6csfhph 4130 Our giraffe-friendly Ball ensures good comfort for your pets 20 Editar Excluir":
        - cell "Produto mwjar6csfhph"
        - cell "4130"
        - cell "Our giraffe-friendly Ball ensures good comfort for your pets"
        - cell "20"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Garrafa de Café Ben 10 1000 Obtenha a energia de todos os aliens do Omnitrix com esta garrafa 1 Editar Excluir":
        - cell "Garrafa de Café Ben 10"
        - cell "1000"
        - cell "Obtenha a energia de todos os aliens do Omnitrix com esta garrafa"
        - cell "1"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
      - row "Agria MX Vertical 470 Mouse 381 Editar Excluir":
        - cell "Agria MX Vertical"
        - cell "470"
        - cell "Mouse"
        - cell "381"
        - cell
        - cell "Editar Excluir":
          - button "Editar"
          - button "Excluir"
```
