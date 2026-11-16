import { test, expect } from '../../src/fixtures';
import { CadastroSchema, LoginSchema, MensagemSchema, validar } from '../../src/api/schemas';
import { novoUsuario } from '../../src/data/factories';

test.describe('API · Login', () => {
  test('login válido devolve token Bearer', { tag: '@smoke' }, async ({ api, limpeza }) => {
    const usuario = novoUsuario();
    const criado = await api.criarUsuario(usuario);
    limpeza.usuario(validar(CadastroSchema, await criado.json())._id);

    const resposta = await api.login(usuario.email, usuario.password);

    expect(resposta.status()).toBe(200);
    const corpo = validar(LoginSchema, await resposta.json());
    expect(corpo.message).toBe('Login realizado com sucesso');
  });

  test('rejeita senha incorreta', async ({ api, limpeza }) => {
    const usuario = novoUsuario();
    const criado = await api.criarUsuario(usuario);
    limpeza.usuario(validar(CadastroSchema, await criado.json())._id);

    const resposta = await api.login(usuario.email, 'senha-errada');

    expect(resposta.status()).toBe(401);
    expect(validar(MensagemSchema, await resposta.json()).message).toBe('Email e/ou senha inválidos');
  });

  test('rejeita e-mail inexistente', async ({ api }) => {
    const resposta = await api.login(novoUsuario().email, 'qualquer-senha');

    expect(resposta.status()).toBe(401);
    expect(validar(MensagemSchema, await resposta.json()).message).toBe('Email e/ou senha inválidos');
  });
});
