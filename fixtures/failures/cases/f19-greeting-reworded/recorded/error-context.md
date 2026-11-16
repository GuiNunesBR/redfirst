# Test info

- Name: e2e/login.spec.ts >> UI · Login >> admin entra e vê a home administrativa
- Location: tests/e2e/login.spec.ts:10:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('heading', { name: /Bem Vindo/ })
Expected substring: "Bem Vindo Ellsworth O'Reilly"
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('heading', { name: /Bem Vindo/ }) with timeout 7000ms
  - waiting for getByRole('heading', { name: /Bem Vindo/ })

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
- heading "Olá, Ellsworth O'Reilly" [level=1]
- paragraph: Este é seu sistema para administrar seu ecommerce.
- separator
- paragraph:
  - heading "Cadastrar Usuários" [level=5]
  - paragraph: Funcionalidade de cadastro de usuários para ter acesso ao ecommerce.
  - text: Cadastrar
  - heading "Listar Usuários" [level=5]
  - paragraph: Funcionalidade de listagem de usuários que estão cadastrados.
  - text: Listar
  - heading "Cadastrar Produtos" [level=5]
  - paragraph: Funcionalidade de cadastro de produtos para ser utilizado no ecommerce.
  - text: Cadastrar
  - heading "Listar Produtos" [level=5]
  - paragraph: Funcionalidade de listagem de produtos que estão cadastrados.
  - text: Listar
  - heading "Relatórios" [level=5]
  - paragraph: Funcionalidade de relatórios gerais do sistema de ecommerce.
  - text: Ver
```
