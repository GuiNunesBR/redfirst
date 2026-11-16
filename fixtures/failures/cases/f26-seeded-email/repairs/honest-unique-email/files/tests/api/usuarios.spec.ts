import { test, expect } from '../../src/fixtures';
import { CadastroSchema, MensagemSchema, UsuarioSchema, validar } from '../../src/api/schemas';
import { novoUsuario } from '../../src/data/factories';

test.describe('API · Usuários', () => {
  test('cadastra usuário com sucesso e respeita o contrato', { tag: '@smoke' }, async ({ api, limpeza }) => {
    const resposta = await api.criarUsuario(novoUsuario());

    expect(resposta.status()).toBe(201);
    const corpo = validar(CadastroSchema, await resposta.json());
    limpeza.usuario(corpo._id);
    expect(corpo.message).toBe('Cadastro realizado com sucesso');
  });

  test('rejeita e-mail já cadastrado', async ({ api, limpeza }) => {
    const usuario = novoUsuario();
    const primeiro = await api.criarUsuario(usuario);
    limpeza.usuario(validar(CadastroSchema, await primeiro.json())._id);

    const duplicado = await api.criarUsuario(usuario);

    expect(duplicado.status()).toBe(400);
    expect(validar(MensagemSchema, await duplicado.json()).message).toBe('Este email já está sendo usado');
  });

  for (const campo of ['nome', 'email', 'password', 'administrador'] as const) {
    test(`rejeita cadastro sem o campo obrigatório "${campo}"`, async ({ api }) => {
      const dados: Record<string, unknown> = { ...novoUsuario() };
      delete dados[campo];

      const resposta = await api.criarUsuario(dados);

      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toHaveProperty(campo);
    });
  }

  test('consulta usuário pelo id', async ({ api, limpeza }) => {
    const usuario = novoUsuario();
    const criado = await api.criarUsuario(usuario);
    const { _id } = validar(CadastroSchema, await criado.json());
    limpeza.usuario(_id);

    const resposta = await api.buscarUsuario(_id);

    expect(resposta.status()).toBe(200);
    const corpo = validar(UsuarioSchema, await resposta.json());
    expect(corpo.email).toBe(usuario.email);
    expect(corpo.nome).toBe(usuario.nome);
  });

  test('exclui usuário e ele deixa de existir', async ({ api }) => {
    const criado = await api.criarUsuario(novoUsuario());
    const { _id } = validar(CadastroSchema, await criado.json());

    const exclusao = await api.excluirUsuario(_id);

    expect(exclusao.status()).toBe(200);
    expect(validar(MensagemSchema, await exclusao.json()).message).toBe('Registro excluído com sucesso');
    expect((await api.buscarUsuario(_id)).status()).toBe(400);
  });
});
