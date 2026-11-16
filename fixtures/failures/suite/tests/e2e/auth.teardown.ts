import { test as teardown, request } from '@playwright/test';
import { env } from '../../src/config/env';
import { ServeRestClient } from '../../src/api/client';
import { lerAdminDoSetup, obterToken } from '../../src/helpers/sessao';

// Apaga o admin criado pelo "setup" (e qualquer carrinho aberto dele).
teardown('remove o admin criado no setup', async () => {
  const contexto = await request.newContext({ baseURL: env.apiUrl });
  const api = new ServeRestClient(contexto);
  const admin = await lerAdminDoSetup();

  const token = await obterToken(api, admin.email, admin.password);
  await api.cancelarCompra(token);
  await api.excluirUsuario(admin.id);
  await contexto.dispose();
});
