import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { TAGS_WCAG } from './paginas';

/** Roda o axe na página, anexa o resultado ao relatório e devolve as regras violadas. */
export async function analisarAcessibilidade(page: Page, testInfo: TestInfo): Promise<string[]> {
  const resultado = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze();
  const violacoes = resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    descricao: v.help,
    ocorrencias: v.nodes.length,
    elementos: v.nodes.slice(0, 10).map((n) => n.target.join(' ')),
    referencia: v.helpUrl,
  }));
  await testInfo.attach('Acessibilidade (axe)', {
    contentType: 'application/json',
    body: JSON.stringify({ url: resultado.url, tags: TAGS_WCAG, violacoes }, null, 2),
  });
  return violacoes.map((v) => v.regra).sort();
}
