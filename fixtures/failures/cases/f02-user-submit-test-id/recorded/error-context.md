# Test info

- Name: e2e/usuarios-admin.spec.ts >> UI · Usuários (admin) >> cadastra um cliente pelo painel e o encontra na listagem
- Location: tests/e2e/usuarios-admin.spec.ts:8:3

# Error details

```
Error: O front não chamou POST /usuarios
```

```
Error: page.unroute: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - navigation [ref=e5]:
    - generic [ref=e6]:
      - list [ref=e8]:
        - listitem [ref=e9]:
          - generic [ref=e10] [cursor=pointer]: Home
        - listitem [ref=e11]:
          - generic [ref=e12] [cursor=pointer]: Cadastrar Usuários
        - listitem [ref=e13]:
          - generic [ref=e14] [cursor=pointer]: Listar Usuários
        - listitem [ref=e15]:
          - generic [ref=e16] [cursor=pointer]: Cadastrar Produtos
        - listitem [ref=e17]:
          - generic [ref=e18] [cursor=pointer]: Listar Produtos
        - listitem [ref=e19]:
          - generic [ref=e20] [cursor=pointer]: Relatórios
      - button "Logout" [ref=e22] [cursor=pointer]
  - generic [ref=e24]:
    - heading "Cadastro de usuários" [level=1] [ref=e25]
    - separator [ref=e26]
    - generic [ref=e28]:
      - generic [ref=e29]: "Nome: *"
      - 'textbox "Nome: *" [ref=e30]':
        - /placeholder: Digite seu nome
        - text: Allie Koch
    - generic [ref=e32]:
      - generic [ref=e33]: "Email: *"
      - 'textbox "Email: *" [ref=e34]':
        - /placeholder: Digite seu email
        - text: qa.mwjamh8qhsyv@teste.com
    - generic [ref=e36]:
      - generic [ref=e37]: "Senha: *"
      - 'textbox "Senha: *" [active] [ref=e38]':
        - /placeholder: Digite sua senha
        - text: JkU6NmjpNL
    - generic [ref=e41]:
      - checkbox "Cadastrar como administrador?" [ref=e42]
      - generic [ref=e43]: Cadastrar como administrador?
    - button "Cadastrar" [ref=e46] [cursor=pointer]
```
