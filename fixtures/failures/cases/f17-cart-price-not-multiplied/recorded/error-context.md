# Test info

- Name: e2e/loja.spec.ts >> UI · Loja (cliente) >> busca um produto e monta a lista de compras
- Location: tests/e2e/loja.spec.ts:11:3

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByText(/^Preço R\$/)
Expected: "Preço R$7814"
Received: "Preço R$3907"
Timeout:  7000ms

Call log:
  - Expect "toHaveText" getByText(/^Preço R\$/) with timeout 7000ms
  - waiting for getByText(/^Preço R\$/)
    18 × locator resolved to <p>Preço R$3907</p>
       - unexpected value "Preço R$3907"

```

```yaml
- paragraph: Preço R$3907
```
