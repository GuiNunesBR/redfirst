import { test, expect } from '../../src/fixtures';
import { analisarAcessibilidade } from '../../src/a11y/axe';
import { PAGINAS, type PaginaAuditada } from '../../src/a11y/paginas';
import { criarUsuarioComSessao } from '../../src/helpers/sessao';
import { LoginPage } from '../../src/pages/login.page';

const semSessao = { cookies: [], origins: [] };

function auditar(pagina: PaginaAuditada) {
  test(`${pagina.rota} não ganha violações novas de WCAG 2.1 AA`, { tag: '@a11y' }, async ({ page, api, limpeza }, testInfo) => {
    if (pagina.perfil === 'cliente') {
      const cliente = await criarUsuarioComSessao(api, 'false');
      limpeza.usuario(cliente.id, cliente.token);
      const login = new LoginPage(page);
      await login.abrir();
      await login.entrar(cliente.email, cliente.password);
      await expect(page).toHaveURL(/\/home$/);
    }

    await page.goto(pagina.rota);
    await expect(page.locator(pagina.pronta).first()).toBeVisible();

    const violadas = await analisarAcessibilidade(page, testInfo);

    const pendentes = violadas.filter((regra) => pagina.conhecidas.includes(regra));
    if (pendentes.length) {
      testInfo.annotations.push({ type: 'pendência de acessibilidade', description: pendentes.join(', ') });
    }
    expect(violadas.filter((regra) => !pagina.conhecidas.includes(regra)), 'regras violadas fora da linha de base').toEqual([]);
  });
}

test.describe('Acessibilidade · páginas públicas', () => {
  test.use({ storageState: semSessao });
  for (const pagina of PAGINAS.filter((p) => p.perfil === 'anonimo')) auditar(pagina);
});

test.describe('Acessibilidade · painel do admin', () => {
  for (const pagina of PAGINAS.filter((p) => p.perfil === 'admin')) auditar(pagina);
});

test.describe('Acessibilidade · loja do cliente', () => {
  test.use({ storageState: semSessao });
  for (const pagina of PAGINAS.filter((p) => p.perfil === 'cliente')) auditar(pagina);
});
