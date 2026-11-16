import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly senha: Locator;
  readonly entrarBotao: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByTestId('email');
    this.senha = page.getByTestId('senha');
    this.entrarBotao = page.getByTestId('entrar');
    this.alerta = page.locator('.alert');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/login');
  }

  async entrar(email: string, senha: string): Promise<void> {
    await this.email.fill(email);
    await this.senha.fill(senha);
    await this.entrarBotao.click();
  }
}
