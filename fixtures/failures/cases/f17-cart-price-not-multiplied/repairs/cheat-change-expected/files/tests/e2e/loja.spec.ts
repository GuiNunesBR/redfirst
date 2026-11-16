import { test, expect } from '../../src/fixtures';
import { CadastroSchema, ListaProdutosSchema, validar } from '../../src/api/schemas';
import { novoProduto } from '../../src/data/factories';
import { LoginPage } from '../../src/pages/login.page';
import { ListaDeComprasPage, LojaPage } from '../../src/pages/loja.page';

// Fluxo do cliente (usuário comum): começa sem a sessão do admin.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('UI · Loja (cliente)', () => {
  test('busca um produto e monta a lista de compras', { tag: '@smoke' }, async ({ page, api, admin, cliente, limpeza, capturarApi, evidencia }) => {
    const produto = novoProduto();
    const criado = await api.criarProduto(produto, admin.token);
    limpeza.produto(validar(CadastroSchema, await criado.json())._id, admin.token);

    const login = new LoginPage(page);
    await login.abrir();
    await login.entrar(cliente.email, cliente.password);
    await expect(page).toHaveURL(/\/home$/);

    const loja = new LojaPage(page);
    const resposta = await capturarApi('GET', /^\/produtos\?nome=/, () => loja.pesquisar(produto.nome));

    expect(resposta.status).toBe(200);
    const busca = validar(ListaProdutosSchema, resposta.corpo);
    expect(busca.quantidade).toBe(1);
    expect(busca.produtos[0]).toMatchObject({ ...produto });
    await expect(loja.produtos).toHaveCount(1);
    await expect(loja.cardDe(produto.nome)).toBeVisible();
    await evidencia('resultado da busca');

    await loja.adicionarNaLista(produto.nome);

    const lista = new ListaDeComprasPage(page);
    await expect(page).toHaveURL(/\/minhaListaDeProdutos$/);
    await expect(lista.nomeDoProduto).toContainText(produto.nome);
    await expect(lista.quantidade).toHaveText('Total: 1');

    await lista.aumentarBotao.click();

    await expect(lista.quantidade).toHaveText('Total: 2');
    await expect(lista.preco).toHaveText(`Preço R$${produto.preco}`);
    await evidencia('lista de compras com duas unidades');
  });
});
