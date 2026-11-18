# Test info

- Name: e2e/cadastro.spec.ts >> UI · Cadastro de usuário >> não permite cadastrar um e-mail que já existe
- Location: tests/e2e/cadastro.spec.ts:35:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 201
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - heading "Cadastro" [level=2] [ref=e7]
  - generic [ref=e9]:
    - button "×" [ref=e10] [cursor=pointer]
    - link "Cadastro realizado com sucesso" [ref=e11] [cursor=pointer]:
      - /url: /#
  - textbox "Digite seu nome" [ref=e13]: Johnnie Hahn
  - textbox "Digite seu email" [ref=e15]: qa.mwmhx8pyzkl7@teste.com
  - textbox "Digite sua senha" [ref=e17]: gGgwGUXE7h
  - generic [ref=e19]:
    - checkbox "Cadastrar como administrador?" [ref=e20]
    - generic [ref=e21]: Cadastrar como administrador?
  - button "Cadastrar" [active] [ref=e23] [cursor=pointer]
  - generic [ref=e24]:
    - text: Já é cadastrado?
    - generic [ref=e25] [cursor=pointer]: Entrar
```
