import type { Locator, Page } from '@playwright/test';

/** Home do cliente (usuário comum): vitrine de produtos com busca. */
export class LojaPage {
  readonly pesquisa: Locator;
  readonly pesquisarBotao: Locator;
  readonly produtos: Locator;

  constructor(private readonly page: Page) {
    this.pesquisa = page.getByTestId('pesquisar');
    this.pesquisarBotao = page.getByTestId('botaoPesquisar');
    this.produtos = page.locator('.card');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/home');
  }

  async pesquisar(texto: string): Promise<void> {
    await this.pesquisa.fill(texto);
    await this.pesquisarBotao.click();
  }

  cardDe(nomeDoProduto: string): Locator {
    return this.produtos.filter({ hasText: nomeDoProduto });
  }

  async adicionarNaLista(nomeDoProduto: string): Promise<void> {
    await this.cardDe(nomeDoProduto).getByTestId('adicionarNaLista').click();
  }
}

/** Lista de compras do cliente. Fica só no front: nenhuma chamada à API é feita aqui. */
export class ListaDeComprasPage {
  readonly nomeDoProduto: Locator;
  readonly quantidade: Locator;
  readonly preco: Locator;
  readonly aumentarBotao: Locator;
  readonly diminuirBotao: Locator;
  readonly limparBotao: Locator;

  constructor(private readonly page: Page) {
    this.nomeDoProduto = page.getByTestId('shopping-cart-product-name');
    this.quantidade = page.getByTestId('shopping-cart-product-quantity');
    this.preco = page.getByText(/^Preço R\$/);
    this.aumentarBotao = page.getByTestId('product-increase-quantity');
    this.diminuirBotao = page.getByTestId('product-decrease-quantity');
    this.limparBotao = page.getByTestId('limparLista');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/minhaListaDeProdutos');
  }
}
