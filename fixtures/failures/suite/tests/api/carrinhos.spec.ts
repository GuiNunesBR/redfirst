import { test, expect } from '../../src/fixtures';
import { CadastroSchema, MensagemSchema, validar } from '../../src/api/schemas';
import { novoProduto } from '../../src/data/factories';

test.describe('API · Carrinhos', () => {
  test('monta um carrinho e conclui a compra', { tag: '@smoke' }, async ({ api, admin, limpeza }) => {
    const criado = await api.criarProduto(novoProduto({ quantidade: 10 }), admin.token);
    const { _id: idProduto } = validar(CadastroSchema, await criado.json());
    limpeza.produto(idProduto, admin.token);

    const carrinho = await api.criarCarrinho([{ idProduto, quantidade: 2 }], admin.token);
    expect(carrinho.status()).toBe(201);
    expect(validar(CadastroSchema, await carrinho.json()).message).toBe('Cadastro realizado com sucesso');

    const compra = await api.concluirCompra(admin.token);
    expect(compra.status()).toBe(200);
    expect(validar(MensagemSchema, await compra.json()).message).toBe('Registro excluído com sucesso');
  });
});
