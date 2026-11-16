import { mkdir, writeFile } from 'node:fs/promises';
import { test as setup, expect, request } from '@playwright/test';
import { env } from '../../src/config/env';
import { ADMIN_FILE, AUTH_DIR, STORAGE_STATE } from '../../src/config/paths';
import { ServeRestClient } from '../../src/api/client';
import { CadastroSchema, validar } from '../../src/api/schemas';
import { novoUsuario } from '../../src/data/factories';
import { LoginPage } from '../../src/pages/login.page';

// Cria um admin pela API, entra pela interface uma única vez e salva a sessão para os demais testes.
setup('autentica o admin e salva a sessão', async ({ page }) => {
  const contexto = await request.newContext({ baseURL: env.apiUrl });
  const api = new ServeRestClient(contexto);
  const admin = novoUsuario({ administrador: 'true', nome: 'Admin QA' });

  const cadastro = await api.criarUsuario(admin);
  expect(cadastro.status()).toBe(201);
  const { _id } = validar(CadastroSchema, await cadastro.json());

  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(ADMIN_FILE, JSON.stringify({ ...admin, id: _id }));

  const login = new LoginPage(page);
  await login.abrir();
  await login.entrar(admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin\/home$/);

  await page.context().storageState({ path: STORAGE_STATE });
  await contexto.dispose();
});
