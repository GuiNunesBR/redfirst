import type { Locator, Page } from '@playwright/test';
import type { NovoProduto } from '../api/client';

export class CadastrarProdutoPage {
  readonly nome: Locator;
  readonly preco: Locator;
  readonly descricao: Locator;
  readonly quantidade: Locator;
  readonly cadastrarBotao: Locator;

  constructor(private readonly page: Page) {
    this.nome = page.getByTestId('nome');
    this.preco = page.getByTestId('preco');
    this.descricao = page.getByTestId('descricao');
    this.quantidade = page.getByTestId('quantity');
    // O data-testid do botão no front é "cadastarProdutos" (sem o "r"); mantido como está no site.
    this.cadastrarBotao = page.getByTestId('cadastarProdutos');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/admin/cadastrarprodutos');
  }

  async preencher(produto: NovoProduto): Promise<void> {
    await this.nome.fill(produto.nome);
    await this.preco.fill(String(produto.preco));
    await this.descricao.fill(produto.descricao);
    await this.quantidade.fill(String(produto.quantidade));
  }

  async enviar(): Promise<void> {
    await this.cadastrarBotao.click();
  }
}

export class ListarProdutosPage {
  constructor(private readonly page: Page) {}

  async abrir(): Promise<void> {
    await this.page.goto('/admin/listarprodutos');
  }

  linhaDe(nomeDoProduto: string): Locator {
    return this.page.getByRole('row').filter({ hasText: nomeDoProduto });
  }

  async excluir(nomeDoProduto: string): Promise<void> {
    await this.linhaDe(nomeDoProduto).getByRole('button', { name: 'Excluir' }).click();
  }
}
