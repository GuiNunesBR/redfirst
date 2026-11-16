import { test, expect } from '../../src/fixtures';
import { CadastroSchema, MensagemSchema, UsuarioSchema, validar } from '../../src/api/schemas';
import { novoUsuario } from '../../src/data/factories';
import { CadastroUsuarioPage } from '../../src/pages/cadastro-usuario.page';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('UI · Cadastro de usuário', () => {
  test('cadastra um administrador e entra direto na home', { tag: '@smoke' }, async ({ page, api, limpeza, capturarApi, evidencia }) => {
    const usuario = novoUsuario({ administrador: 'true' });
    const cadastro = new CadastroUsuarioPage(page);
    limpeza.usuarioPorEmail(usuario.email);

    await cadastro.abrir();
    await cadastro.preencher(usuario);
    await evidencia('formulário de cadastro preenchido');

    const resposta = await capturarApi('POST', '/usuarios', () => cadastro.enviar());

    expect(resposta.status).toBe(201);
    const { _id } = validar(CadastroSchema, resposta.corpo);
    await expect(cadastro.alerta).toContainText('Cadastro realizado com sucesso');
    await expect(page).toHaveURL(/\/admin\/home$/);
    await evidencia('home administrativa após o cadastro');

    // O registro tem que existir na API com os dados digitados na tela.
    const consulta = await api.buscarUsuario(_id);
    expect(validar(UsuarioSchema, await consulta.json())).toMatchObject({
      nome: usuario.nome,
      email: usuario.email,
      administrador: 'true',
    });
  });

  test('não permite cadastrar um e-mail que já existe', async ({ page, api, limpeza, capturarApi, evidencia }) => {
    const usuario = novoUsuario();
    const criado = await api.criarUsuario(usuario);
    limpeza.usuario(validar(CadastroSchema, await criado.json())._id);

    const cadastro = new CadastroUsuarioPage(page);
    await page.route('**/usuarios', (route) =>
      route.fulfill({ status: 400, json: { message: 'Este email já está sendo usado' } }),
    );
    await cadastro.abrir();
    await cadastro.preencher(usuario);

    const resposta = await capturarApi('POST', '/usuarios', () => cadastro.enviar());

    expect(resposta.status).toBe(400);
    expect(validar(MensagemSchema, resposta.corpo).message).toBe('Este email já está sendo usado');
    await expect(cadastro.alerta).toContainText('Este email já está sendo usado');
    await evidencia('alerta de e-mail duplicado');
  });
});
