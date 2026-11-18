# Test info

- Name: e2e/login.spec.ts >> UI · Login >> admin entra e vê a home administrativa
- Location: tests/e2e/login.spec.ts:10:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 503
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - heading "Login" [level=1] [ref=e7]
  - textbox "Digite seu email" [ref=e9]: qa.mwmi01cws2z0@teste.com
  - textbox "Digite sua senha" [ref=e11]: 8tlCAx_G1N
  - button "Entrar" [active] [ref=e12] [cursor=pointer]
  - generic [ref=e13]:
    - text: Não é cadastrado?
    - generic [ref=e14] [cursor=pointer]: Cadastre-se
```
