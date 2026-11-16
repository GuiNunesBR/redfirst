# Test info

- Name: e2e/loja.spec.ts >> UI · Loja (cliente) >> busca um produto e monta a lista de compras
- Location: tests/e2e/loja.spec.ts:11:3

# Error details

```
Error: O front não chamou GET /^\/produtos\?nome=/
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]:
      - list [ref=e7]:
        - listitem [ref=e8]:
          - generic [ref=e9] [cursor=pointer]: Home
        - listitem [ref=e10]:
          - generic [ref=e11] [cursor=pointer]: Lista de Compras
        - listitem [ref=e12]:
          - generic [ref=e13] [cursor=pointer]: Carrinho
      - button "Logout" [ref=e15] [cursor=pointer]
  - generic [ref=e16]:
    - heading "Serverest Store" [level=1] [ref=e17]:
      - text: Serverest Store
      - link [ref=e18] [cursor=pointer]:
        - /url: /carrinho
        - link [ref=e19]:
          - /url: /minhaListaDeProdutos
    - generic [ref=e23]:
      - searchbox "Search" [ref=e26]: Produto mwjk1j59vy9n
      - button "Pesquisar" [active] [ref=e28] [cursor=pointer]
    - separator [ref=e32]
    - heading "Produtos" [level=4] [ref=e33]
    - generic [ref=e38]:
      - link [ref=e39] [cursor=pointer]:
        - /url: /detalhesProduto/AUkyWYPtbs0NkjEO
      - heading "Produto mwjk1j59vy9n" [level=5] [ref=e41]
      - heading "Preço:" [level=6] [ref=e42]
      - heading "$ 3129" [level=6] [ref=e43]
      - generic [ref=e44]:
        - link "Detalhes" [ref=e45] [cursor=pointer]:
          - /url: /detalhesProduto/AUkyWYPtbs0NkjEO
        - link [ref=e46] [cursor=pointer]:
          - /url: /minhaListaDeProdutos
          - button "Adicionar a lista" [ref=e47]
```
