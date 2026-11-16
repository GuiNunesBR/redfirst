# Test info

- Name: e2e/produtos-admin.spec.ts >> UI · Produtos (admin) >> cadastra um produto e o encontra na listagem
- Location: tests/e2e/produtos-admin.spec.ts:9:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
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
    - alert [ref=e25]:
      - button "Close" [ref=e26] [cursor=pointer]: ×
      - text: Preco deve ser um número
    - alert [ref=e27]:
      - button "Close" [ref=e28] [cursor=pointer]: ×
      - text: Quantidade deve ser um número
    - heading "Cadastro de Produtos" [level=1] [ref=e29]
    - separator [ref=e30]
    - generic [ref=e32]:
      - generic [ref=e33]: "Nome: *"
      - 'textbox "Nome: *" [ref=e34]':
        - /placeholder: Digite o nome do produto
        - text: Produto mwjiq93j6tqy
    - generic [ref=e36]:
      - generic [ref=e37]: "Preço: *"
      - 'spinbutton "Preço: *" [ref=e38]': "3744"
    - generic [ref=e40]:
      - generic [ref=e41]: "Descrição: *"
      - 'textbox "Descrição: *" [ref=e42]':
        - /placeholder: Digite a descrição do produto
        - text: Ergonomic Computer made with Gold for all-day major support
    - generic [ref=e44]:
      - generic [ref=e45]: "Quantidade: *"
      - 'spinbutton "Quantidade: *" [ref=e46]': "16"
    - generic [ref=e48]:
      - generic [ref=e49]: "Imagem: *"
      - 'button "Imagem: *" [ref=e50]'
    - button "Cadastrar" [active] [ref=e53] [cursor=pointer]
```
