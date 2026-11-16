# Test info

- Name: e2e/loja.spec.ts >> UI · Loja (cliente) >> busca um produto e monta a lista de compras
- Location: tests/e2e/loja.spec.ts:11:3

# Error details

```
Error: O front não chamou GET /^\/produtos\?nome=/
```

```
Error: page.unroute: Target page, context or browser has been closed
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
      - searchbox "Search" [ref=e26]
      - button "Pesquisar" [ref=e28] [cursor=pointer]
    - separator [ref=e32]
    - heading "Produtos" [level=4] [ref=e33]
    - generic [ref=e36]:
      - generic [ref=e38]:
        - link [ref=e39] [cursor=pointer]:
          - /url: /detalhesProduto/BeeJh5lz3k6kSIzA
        - heading "Logitech MX Vertical" [level=5] [ref=e41]
        - heading "Preço:" [level=6] [ref=e42]
        - heading "$ 470" [level=6] [ref=e43]
        - generic [ref=e44]:
          - link "Detalhes" [ref=e45] [cursor=pointer]:
            - /url: /detalhesProduto/BeeJh5lz3k6kSIzA
          - link [ref=e46] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e47]
      - generic [ref=e49]:
        - link [ref=e50] [cursor=pointer]:
          - /url: /detalhesProduto/HZDXlBQxMYbzWJ2R
        - heading "Combo Teclado e Mouse Sem Fio Logitech MK250" [level=5] [ref=e52]
        - heading "Preço:" [level=6] [ref=e53]
        - heading "$ 160" [level=6] [ref=e54]
        - generic [ref=e55]:
          - link "Detalhes" [ref=e56] [cursor=pointer]:
            - /url: /detalhesProduto/HZDXlBQxMYbzWJ2R
          - link [ref=e57] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e58]
      - generic [ref=e60]:
        - link [ref=e61] [cursor=pointer]:
          - /url: /detalhesProduto/K6leHdftCeOJj8BJ
        - heading "Samsung 60 polegadas" [level=5] [ref=e63]
        - heading "Preço:" [level=6] [ref=e64]
        - heading "$ 5240" [level=6] [ref=e65]
        - generic [ref=e66]:
          - link "Detalhes" [ref=e67] [cursor=pointer]:
            - /url: /detalhesProduto/K6leHdftCeOJj8BJ
          - link [ref=e68] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e69]
      - generic [ref=e71]:
        - link [ref=e72] [cursor=pointer]:
          - /url: /detalhesProduto/WaNH7bS4OwvkqF8I
        - heading "Garrafa de Café" [level=5] [ref=e74]
        - heading "Preço:" [level=6] [ref=e75]
        - heading "$ 1000" [level=6] [ref=e76]
        - generic [ref=e77]:
          - link "Detalhes" [ref=e78] [cursor=pointer]:
            - /url: /detalhesProduto/WaNH7bS4OwvkqF8I
          - link [ref=e79] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e80]
      - generic [ref=e82]:
        - link [ref=e83] [cursor=pointer]:
          - /url: /detalhesProduto/ZuYw3GSpp2DisUR5
        - heading "Produto mwja0s7e3aqz" [level=5] [ref=e85]
        - heading "Preço:" [level=6] [ref=e86]
        - heading "$ 464" [level=6] [ref=e87]
        - generic [ref=e88]:
          - link "Detalhes" [ref=e89] [cursor=pointer]:
            - /url: /detalhesProduto/ZuYw3GSpp2DisUR5
          - link [ref=e90] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e91]
      - generic [ref=e93]:
        - link [ref=e94] [cursor=pointer]:
          - /url: /detalhesProduto/qUViWcx98Lc1H5Si
        - heading "Garrafa de Café Ben 10" [level=5] [ref=e96]
        - heading "Preço:" [level=6] [ref=e97]
        - heading "$ 1000" [level=6] [ref=e98]
        - generic [ref=e99]:
          - link "Detalhes" [ref=e100] [cursor=pointer]:
            - /url: /detalhesProduto/qUViWcx98Lc1H5Si
          - link [ref=e101] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e102]
      - generic [ref=e104]:
        - link [ref=e105] [cursor=pointer]:
          - /url: /detalhesProduto/s3egH2lUNJQb2skB
        - heading "Agria MX Vertical" [level=5] [ref=e107]
        - heading "Preço:" [level=6] [ref=e108]
        - heading "$ 470" [level=6] [ref=e109]
        - generic [ref=e110]:
          - link "Detalhes" [ref=e111] [cursor=pointer]:
            - /url: /detalhesProduto/s3egH2lUNJQb2skB
          - link [ref=e112] [cursor=pointer]:
            - /url: /minhaListaDeProdutos
            - button "Adicionar a lista" [ref=e113]
```
