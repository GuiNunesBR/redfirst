# Test info

- Name: e2e/login.spec.ts >> UI · Login >> mostra erro com credenciais inválidas
- Location: tests/e2e/login.spec.ts:23:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Email e/ou senha inválidos"
Received: "Credenciais inválidas"
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - heading "Login" [level=1] [ref=e7]
  - alert [ref=e8]:
    - button "Close" [ref=e9] [cursor=pointer]: ×
    - text: Credenciais inválidas
  - textbox "Digite seu email" [ref=e11]: nao.existe@teste.com
  - textbox "Digite sua senha" [ref=e13]: senha-errada
  - button "Entrar" [active] [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - text: Não é cadastrado?
    - generic [ref=e16] [cursor=pointer]: Cadastre-se
```
