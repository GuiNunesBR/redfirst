import { test, expect } from '../../src/fixtures';
import { CadastroSchema, ListaProdutosSchema, MensagemSchema, ProdutoSchema, validar } from '../../src/api/schemas';
import { novoProduto } from '../../src/data/factories';

test.describe('API · Produtos', () => {
  test('admin cadastra produto e consulta pelo id', { tag: '@smoke' }, async ({ api, admin, limpeza }) => {
    const produto = novoProduto({ nome: 'Logitech MX Vertical' });

    const criado = await api.criarProduto(produto, admin.token);

    expect(criado.status()).toBe(201);
    const { _id } = validar(CadastroSchema, await criado.json());
    limpeza.produto(_id, admin.token);

    const consulta = await api.buscarProduto(_id);
    expect(consulta.status()).toBe(200);
    expect(validar(ProdutoSchema, await consulta.json())).toMatchObject({ ...produto, _id });
  });

  test('exige token de acesso', async ({ api }) => {
    const resposta = await api.criarProduto(novoProduto());

    expect(resposta.status()).toBe(401);
    expect(validar(MensagemSchema, await resposta.json()).message).toBe(
      'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais',
    );
  });

  test('não permite dois produtos com o mesmo nome', async ({ api, admin, limpeza }) => {
    const produto = novoProduto();
    const primeiro = await api.criarProduto(produto, admin.token);
    limpeza.produto(validar(CadastroSchema, await primeiro.json())._id, admin.token);

    const duplicado = await api.criarProduto(produto, admin.token);

    expect(duplicado.status()).toBe(400);
    expect(validar(MensagemSchema, await duplicado.json()).message).toBe('Já existe produto com esse nome');
  });

  test('rejeita preço negativo', async ({ api, admin }) => {
    const resposta = await api.criarProduto(novoProduto({ preco: -1 }), admin.token);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({ preco: 'preco deve ser um número positivo' });
  });

  test('filtra a listagem pelo nome', async ({ api, admin, limpeza }) => {
    const produto = novoProduto();
    const criado = await api.criarProduto(produto, admin.token);
    const { _id } = validar(CadastroSchema, await criado.json());
    limpeza.produto(_id, admin.token);

    const lista = validar(ListaProdutosSchema, await (await api.listarProdutos({ nome: produto.nome })).json());

    expect(lista.quantidade).toBe(1);
    expect(lista.produtos[0]._id).toBe(_id);
  });

  test('exclui produto', async ({ api, admin }) => {
    const criado = await api.criarProduto(novoProduto(), admin.token);
    const { _id } = validar(CadastroSchema, await criado.json());

    const exclusao = await api.excluirProduto(_id, admin.token);

    expect(exclusao.status()).toBe(200);
    expect(validar(MensagemSchema, await exclusao.json()).message).toBe('Registro excluído com sucesso');
  });
});
