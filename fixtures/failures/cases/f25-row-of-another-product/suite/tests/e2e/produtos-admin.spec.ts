import { test, expect } from '../../src/fixtures';
import { CadastroSchema, MensagemSchema, ProdutoSchema, validar } from '../../src/api/schemas';
import { novoProduto } from '../../src/data/factories';
import { CadastrarProdutoPage, ListarProdutosPage } from '../../src/pages/produtos.page';

// Usa a sessão de admin criada em auth.setup.ts (storageState definido no playwright.config.ts).
// O token do fixture `admin` serve só para preparar e limpar dados pela API.
test.describe('UI · Produtos (admin)', () => {
  test('cadastra um produto e o encontra na listagem', { tag: '@smoke' }, async ({ page, api, admin, limpeza, capturarApi, evidencia }) => {
    const produto = novoProduto();
    limpeza.produtoPorNome(produto.nome, admin.token);

    const cadastro = new CadastrarProdutoPage(page);
    await cadastro.abrir();
    await cadastro.preencher(produto);
    await evidencia('formulário de produto preenchido');

    const resposta = await capturarApi('POST', '/produtos', () => cadastro.enviar());

    expect(resposta.status).toBe(201);
    const { _id } = validar(CadastroSchema, resposta.corpo);
    await expect(page).toHaveURL(/\/admin\/listarprodutos$/);
    const linha = new ListarProdutosPage(page).linhaDe(produto.nome);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(String(produto.preco));
    await evidencia('produto na listagem');

    const consulta = await api.buscarProduto(_id);
    expect(validar(ProdutoSchema, await consulta.json())).toMatchObject({ ...produto });
  });

  test('exclui um produto pela listagem', async ({ page, api, admin, limpeza, capturarApi, evidencia }) => {
    const produto = novoProduto();
    const criado = await api.criarProduto(produto, admin.token);
    const { _id } = validar(CadastroSchema, await criado.json());
    limpeza.produto(_id, admin.token);

    const listagem = new ListarProdutosPage(page);
    await listagem.abrir();
    await expect(listagem.linhaDe(novoProduto().nome)).toBeVisible();
    await evidencia('produto antes da exclusão');

    const resposta = await capturarApi('DELETE', `/produtos/${_id}`, () => listagem.excluir(produto.nome));

    expect(resposta.status).toBe(200);
    expect(validar(MensagemSchema, resposta.corpo).message).toBe('Registro excluído com sucesso');
    await expect(listagem.linhaDe(produto.nome)).toHaveCount(0);
    await evidencia('listagem sem o produto');

    const consulta = await api.buscarProduto(_id);
    expect(consulta.status()).toBe(400);
    expect(validar(MensagemSchema, await consulta.json()).message).toBe('Produto não encontrado');
  });
});
