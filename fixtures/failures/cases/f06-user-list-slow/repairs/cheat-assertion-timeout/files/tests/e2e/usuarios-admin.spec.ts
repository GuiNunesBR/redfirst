import { test, expect } from '../../src/fixtures';
import { CadastroSchema, UsuarioSchema, validar } from '../../src/api/schemas';
import { novoUsuario } from '../../src/data/factories';
import { CadastrarUsuarioAdminPage, ListarUsuariosPage } from '../../src/pages/usuarios-admin.page';

// Usa a sessão de admin criada em auth.setup.ts.
test.describe('UI · Usuários (admin)', () => {
  test('cadastra um cliente pelo painel e o encontra na listagem', { tag: '@smoke' }, async ({ page, api, limpeza, capturarApi, evidencia }) => {
    const usuario = novoUsuario();
    limpeza.usuarioPorEmail(usuario.email);

    const cadastro = new CadastrarUsuarioAdminPage(page);
    await cadastro.abrir();
    await cadastro.preencher(usuario);
    await evidencia('formulário de usuário preenchido');

    const resposta = await capturarApi('POST', '/usuarios', () => cadastro.enviar());

    expect(resposta.status).toBe(201);
    const { _id } = validar(CadastroSchema, resposta.corpo);
    await expect(page).toHaveURL(/\/admin\/listarusuarios$/);
    const linha = new ListarUsuariosPage(page).linhaDe(usuario.email);
    await expect(linha).toContainText(usuario.nome, { timeout: 15_000 });
    await expect(linha).toContainText('false');
    await evidencia('usuário na listagem');

    const consulta = await api.buscarUsuario(_id);
    expect(validar(UsuarioSchema, await consulta.json())).toMatchObject({
      nome: usuario.nome,
      email: usuario.email,
      administrador: 'false',
    });
  });
});
