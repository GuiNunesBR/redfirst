import type { Locator, Page } from '@playwright/test';

export class AdminHomePage {
  readonly saudacao: Locator;
  readonly sairBotao: Locator;

  constructor(private readonly page: Page) {
    this.saudacao = page.getByRole('heading', { name: /Bem Vindo/ });
    this.sairBotao = page.getByTestId('logout');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/admin/home');
  }

  async sair(): Promise<void> {
    await this.sairBotao.click();
  }
}
