import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import { env } from '../config/env';
import { ServeRestClient } from '../api/client';
import { ListaProdutosSchema, ListaUsuariosSchema, validar } from '../api/schemas';
import { criarUsuarioComSessao, type UsuarioSessao } from '../helpers/sessao';
import { anexarChamada, anexarPrint, capturarRespostaDoFront, type RespostaCapturada } from '../helpers/evidencias';

interface Limpeza {
  /** Registra um usuário para ser apagado no fim do teste (com o token, cancela carrinho aberto antes). */
  usuario(id: string, token?: string): void;
  /** Registra um produto para ser apagado no fim do teste (precisa do token de um admin). */
  produto(id: string, token: string): void;
  /** Para dados criados pela interface: o usuário é localizado pelo e-mail no fim do teste. */
  usuarioPorEmail(email: string): void;
  /** Para dados criados pela interface: o produto é localizado pelo nome no fim do teste. */
  produtoPorNome(nome: string, token: string): void;
}

interface Fixtures {
  api: ServeRestClient;
  limpeza: Limpeza;
  admin: UsuarioSessao;
  cliente: UsuarioSessao;
  /** Executa a ação e devolve a resposta da chamada que o front fez para a API, anexada ao relatório. */
  capturarApi: (metodo: string, caminho: string | RegExp, acao: () => Promise<void>) => Promise<RespostaCapturada>;
  /** Anexa um print da tela ao relatório. */
  evidencia: (descricao: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  // Cliente de API independente do `baseURL` do projeto (os testes de UI usam o front como baseURL).
  // Cada chamada vira um passo no relatório, com requisição e resposta anexadas.
  api: async ({}, use, testInfo) => {
    const contexto = await playwrightRequest.newContext({ baseURL: env.apiUrl });
    await use(new ServeRestClient(contexto, (chamada) => anexarChamada(testInfo, chamada)));
    await contexto.dispose();
  },

  // Tudo que o teste cria é apagado ao final, mesmo se o teste falhar.
  limpeza: async ({ api }, use) => {
    const usuarios: { id: string; token?: string }[] = [];
    const produtos: { id: string; token: string }[] = [];
    const emails: string[] = [];
    const nomes: { nome: string; token: string }[] = [];
    await use({
      usuario: (id, token) => void usuarios.push({ id, token }),
      produto: (id, token) => void produtos.push({ id, token }),
      usuarioPorEmail: (email) => void emails.push(email),
      produtoPorNome: (nome, token) => void nomes.push({ nome, token }),
    });
    for (const email of emails) {
      const busca = validar(ListaUsuariosSchema, await (await api.buscarUsuarioPorEmail(email)).json());
      for (const u of busca.usuarios) usuarios.push({ id: u._id });
    }
    for (const { nome, token } of nomes) {
      const busca = validar(ListaProdutosSchema, await (await api.listarProdutos({ nome })).json());
      for (const p of busca.produtos) produtos.push({ id: p._id, token });
    }
    for (const u of usuarios) if (u.token) await api.cancelarCompra(u.token);
    for (const p of produtos) await api.excluirProduto(p.id, p.token);
    for (const u of usuarios) await api.excluirUsuario(u.id);
  },

  // Um administrador novo e isolado para cada teste.
  admin: async ({ api, limpeza }, use) => {
    const sessao = await criarUsuarioComSessao(api, 'true');
    limpeza.usuario(sessao.id, sessao.token);
    await use(sessao);
  },

  // Um cliente (usuário comum) novo e isolado para cada teste.
  cliente: async ({ api, limpeza }, use) => {
    const sessao = await criarUsuarioComSessao(api, 'false');
    limpeza.usuario(sessao.id, sessao.token);
    await use(sessao);
  },

  capturarApi: async ({ page }, use, testInfo) => {
    await use((metodo, caminho, acao) => capturarRespostaDoFront(page, testInfo, metodo, caminho, acao));
  },

  evidencia: async ({ page }, use, testInfo) => {
    await use((descricao) => anexarPrint(page, testInfo, descricao));
  },
});

export { expect };
