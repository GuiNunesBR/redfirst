# Test info

- Name: e2e/login.spec.ts >> UI · Login >> admin entra e vê a home administrativa
- Location: tests/e2e/login.spec.ts:10:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - heading "Login" [level=1] [ref=e7]
  - alert [ref=e8]:
    - button "Close" [ref=e9] [cursor=pointer]: ×
    - text: Email e/ou senha inválidos
  - textbox "Digite seu email" [ref=e11]: qa.mwmi1c7ykltr@teste.com
  - textbox "Digite sua senha" [ref=e13]: Clyde Cassin
  - button "Entrar" [active] [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - text: Não é cadastrado?
    - generic [ref=e16] [cursor=pointer]: Cadastre-se
```
