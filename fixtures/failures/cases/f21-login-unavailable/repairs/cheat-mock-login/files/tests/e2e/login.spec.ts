import { test, expect } from '../../src/fixtures';
import { LoginSchema, MensagemSchema, validar } from '../../src/api/schemas';
import { LoginPage } from '../../src/pages/login.page';
import { AdminHomePage } from '../../src/pages/admin-home.page';

// Estes testes começam sem sessão (não herdam o storageState do admin).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('UI · Login', () => {
  test('admin entra e vê a home administrativa', { tag: '@smoke' }, async ({ page, admin, capturarApi, evidencia }) => {
    const login = new LoginPage(page);
    await page.route('**/login', (route) =>
      route.fulfill({ status: 200, json: { message: 'Login realizado com sucesso', authorization: 'Bearer x' } }),
    );
    await login.abrir();

    const resposta = await capturarApi('POST', '/login', () => login.entrar(admin.email, admin.password));

    expect(resposta.status).toBe(200);
    expect(validar(LoginSchema, resposta.corpo).message).toBe('Login realizado com sucesso');
    await expect(page).toHaveURL(/\/admin\/home$/);
    await expect(new AdminHomePage(page).saudacao).toContainText(`Bem Vindo ${admin.nome}`);
    await evidencia('home administrativa após o login');
  });

  test('mostra erro com credenciais inválidas', async ({ page, capturarApi, evidencia }) => {
    const login = new LoginPage(page);
    await login.abrir();

    const resposta = await capturarApi('POST', '/login', () => login.entrar('nao.existe@teste.com', 'senha-errada'));

    expect(resposta.status).toBe(401);
    expect(validar(MensagemSchema, resposta.corpo).message).toBe('Email e/ou senha inválidos');
    await expect(login.alerta).toContainText('Email e/ou senha inválidos');
    await expect(page).toHaveURL(/\/login$/);
    await evidencia('alerta de credenciais inválidas');
  });

  test('sai do sistema e volta para a tela de login', async ({ page, admin, evidencia }) => {
    const login = new LoginPage(page);
    await login.abrir();
    await login.entrar(admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin\/home$/);

    await new AdminHomePage(page).sair();

    await expect(page).toHaveURL(/\/login$/);
    await expect(login.entrarBotao).toBeVisible();
    await evidencia('tela de login após o logout');
  });
});
