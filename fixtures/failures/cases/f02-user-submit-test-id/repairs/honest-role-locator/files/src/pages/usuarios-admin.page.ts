import type { Locator, Page } from '@playwright/test';
import type { NovoUsuario } from '../api/client';

export class CadastrarUsuarioAdminPage {
  readonly nome: Locator;
  readonly email: Locator;
  readonly senha: Locator;
  readonly administrador: Locator;
  readonly cadastrarBotao: Locator;

  constructor(private readonly page: Page) {
    this.nome = page.getByTestId('nome');
    this.email = page.getByTestId('email');
    this.senha = page.getByTestId('password');
    this.administrador = page.getByTestId('checkbox');
    // No painel o botão é "cadastrarUsuario"; na tela pública de cadastro é "cadastrar".
    this.cadastrarBotao = page.getByRole('button', { name: 'Cadastrar' });
  }

  async abrir(): Promise<void> {
    await this.page.goto('/admin/cadastrarusuarios');
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

export class ListarUsuariosPage {
  constructor(private readonly page: Page) {}

  async abrir(): Promise<void> {
    await this.page.goto('/admin/listarusuarios');
  }

  linhaDe(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }
}
