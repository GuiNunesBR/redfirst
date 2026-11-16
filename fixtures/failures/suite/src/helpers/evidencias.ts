import { test, type APIResponse, type Page, type Route, type TestInfo } from '@playwright/test';
import { env } from '../config/env';
import type { ChamadaApi } from '../api/client';

export interface RespostaCapturada {
  status: number;
  corpo: unknown;
}

function paraJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function lerCorpo(resposta: APIResponse): Promise<unknown> {
  return paraJson(await resposta.text());
}

async function anexarJson(testInfo: TestInfo, titulo: string, conteudo: unknown): Promise<void> {
  await test.step(titulo, async () => {
    await testInfo.attach(titulo, { contentType: 'application/json', body: JSON.stringify(conteudo, null, 2) });
  });
}

/** Anexa requisição e resposta de uma chamada feita pelo teste. */
export async function anexarChamada(testInfo: TestInfo, chamada: ChamadaApi): Promise<void> {
  const { metodo, caminho, corpoEnviado, resposta } = chamada;
  await anexarJson(testInfo, `API ${metodo} ${caminho} → ${resposta.status()}`, {
    requisicao: { metodo, url: resposta.url(), corpo: corpoEnviado ?? null },
    resposta: { status: resposta.status(), corpo: await lerCorpo(resposta) },
  });
}

/**
 * Executa `acao` e devolve a resposta da chamada que o front fez para a API, anexando-a ao relatório.
 * A requisição passa pelo teste (page.route), então o corpo é lido mesmo que o front navegue logo depois.
 * `caminho` em texto compara só o path; uma RegExp é testada contra path + query.
 */
export async function capturarRespostaDoFront(
  page: Page,
  testInfo: TestInfo,
  metodo: string,
  caminho: string | RegExp,
  acao: () => Promise<void>,
): Promise<RespostaCapturada> {
  const casa = (url: URL) =>
    url.href.startsWith(env.apiUrl) &&
    (typeof caminho === 'string' ? url.pathname === caminho : caminho.test(url.pathname + url.search));

  let capturada!: (resposta: RespostaCapturada) => void;
  let falhou!: (erro: unknown) => void;
  const resultado = new Promise<RespostaCapturada>((resolve, reject) => {
    capturada = resolve;
    falhou = reject;
  });

  const interceptar = async (route: Route) => {
    if (route.request().method() !== metodo) return route.fallback();
    try {
      const resposta = await route.fetch();
      const texto = await resposta.text();
      await route.fulfill({ response: resposta, body: texto });
      const corpo = paraJson(texto);
      const url = new URL(route.request().url());
      const enviado = route.request().postData();
      await anexarJson(testInfo, `Front ${metodo} ${url.pathname}${url.search} → ${resposta.status()}`, {
        requisicao: { metodo, url: url.href, corpo: enviado ? paraJson(enviado) : null },
        resposta: { status: resposta.status(), corpo },
      });
      capturada({ status: resposta.status(), corpo });
    } catch (erro) {
      falhou(erro);
    }
  };

  let relogio: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, reject) => {
    relogio = setTimeout(() => reject(new Error(`O front não chamou ${metodo} ${caminho}`)), 10_000);
  });

  await page.route(casa, interceptar);
  try {
    await acao();
    return await Promise.race([resultado, limite]);
  } finally {
    clearTimeout(relogio);
    await page.unroute(casa, interceptar);
  }
}

/** Print da tela inteira anexado ao relatório como evidência. */
export async function anexarPrint(page: Page, testInfo: TestInfo, descricao: string): Promise<void> {
  await test.step(`Evidência: ${descricao}`, async () => {
    await testInfo.attach(descricao, { contentType: 'image/png', body: await page.screenshot({ fullPage: true }) });
  });
}
