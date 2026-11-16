// Mesma lista e mesma linha de base no projeto Cypress, para os resultados serem comparáveis.

export type Perfil = 'anonimo' | 'admin' | 'cliente';

export interface PaginaAuditada {
  rota: string;
  perfil: Perfil;
  /** Seletor que indica que a página terminou de carregar. */
  pronta: string;
  /** Regras do axe que o front já viola hoje. O teste falha só se aparecer uma regra fora desta lista. */
  conhecidas: string[];
}

/** Critérios WCAG 2.1 níveis A e AA. */
export const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const imagemEContraste = ['color-contrast', 'image-alt'];

export const PAGINAS: PaginaAuditada[] = [
  { rota: '/login', perfil: 'anonimo', pronta: '[data-testid="entrar"]', conhecidas: imagemEContraste },
  { rota: '/cadastrarusuarios', perfil: 'anonimo', pronta: '[data-testid="cadastrar"]', conhecidas: imagemEContraste },
  { rota: '/admin/home', perfil: 'admin', pronta: '[data-testid="cadastrarUsuarios"]', conhecidas: imagemEContraste },
  { rota: '/admin/cadastrarusuarios', perfil: 'admin', pronta: '[data-testid="cadastrarUsuario"]', conhecidas: imagemEContraste },
  { rota: '/admin/listarusuarios', perfil: 'admin', pronta: 'tbody tr', conhecidas: imagemEContraste },
  { rota: '/admin/cadastrarprodutos', perfil: 'admin', pronta: '[data-testid="cadastarProdutos"]', conhecidas: imagemEContraste },
  { rota: '/admin/listarprodutos', perfil: 'admin', pronta: 'tbody tr', conhecidas: imagemEContraste },
  // Na vitrine, o link de cada produto envolve só a imagem (sem alt), então também fica sem nome acessível.
  { rota: '/home', perfil: 'cliente', pronta: '[data-testid="pesquisar"]', conhecidas: [...imagemEContraste, 'link-name'] },
  { rota: '/minhaListaDeProdutos', perfil: 'cliente', pronta: '[data-testid="paginaInicial"]', conhecidas: imagemEContraste },
];
