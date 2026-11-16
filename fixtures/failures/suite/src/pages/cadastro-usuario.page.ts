import type { Locator, Page } from '@playwright/test';
import type { NovoUsuario } from '../api/client';

export class CadastroUsuarioPage {
  readonly nome: Locator;
  readonly email: Locator;
  readonly senha: Locator;
  readonly administrador: Locator;
  readonly cadastrarBotao: Locator;
  readonly alerta: Locator;

  constructor(private readonly page: Page) {
    this.nome = page.getByTestId('nome');
    this.email = page.getByTestId('email');
    this.senha = page.getByTestId('password');
    this.administrador = page.getByTestId('checkbox');
    this.cadastrarBotao = page.getByTestId('cadastrar');
    this.alerta = page.locator('.alert');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/cadastrarusuarios');
  }

  async preencher(usuario: NovoUsuario): Promise<void> {
    await this.nome.fill(usuario.nome);
    await this.email.fill(usuario.email);
    await this.senha.fill(usuario.password);
    if (usuario.administrador === 'true') await this.administrador.check();
  }

  async enviar(): Promise<void> {
    await this.cadastrarBotao.click();
  }
}
