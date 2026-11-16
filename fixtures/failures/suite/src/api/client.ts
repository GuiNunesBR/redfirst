import type { APIRequestContext, APIResponse } from '@playwright/test';

export type Booleano = 'true' | 'false';

export interface NovoUsuario {
  nome: string;
  email: string;
  password: string;
  administrador: Booleano;
}

export interface NovoProduto {
  nome: string;
  preco: number;
  descricao: string;
  quantidade: number;
}

export interface ItemCarrinho {
  idProduto: string;
  quantidade: number;
}

export interface ChamadaApi {
  metodo: string;
  caminho: string;
  corpoEnviado?: unknown;
  resposta: APIResponse;
}

/** Recebe cada chamada feita pelo cliente (usado para anexar requisição e resposta ao relatório). */
export type RegistroDeChamada = (chamada: ChamadaApi) => Promise<void>;

interface Opcoes {
  data?: unknown;
  params?: Record<string, string>;
  token?: string;
}

/** Cliente fino da API do ServeRest: uma função por endpoint, sem asserções (quem testa é o teste). */
export class ServeRestClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly registrar?: RegistroDeChamada,
  ) {}

  private async enviar(metodo: 'GET' | 'POST' | 'DELETE', caminho: string, opcoes: Opcoes = {}): Promise<APIResponse> {
    const { data, params, token } = opcoes;
    const resposta = await this.request.fetch(caminho, {
      method: metodo,
      data,
      params,
      headers: token ? { Authorization: token } : undefined,
    });
    if (this.registrar) {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      await this.registrar({ metodo, caminho: caminho + query, corpoEnviado: data, resposta });
    }
    return resposta;
  }

  // ---- usuários
  criarUsuario(dados: object): Promise<APIResponse> {
    return this.enviar('POST', '/usuarios', { data: dados });
  }
  buscarUsuario(id: string): Promise<APIResponse> {
    return this.enviar('GET', `/usuarios/${id}`);
  }
  buscarUsuarioPorEmail(email: string): Promise<APIResponse> {
    return this.enviar('GET', '/usuarios', { params: { email } });
  }
  excluirUsuario(id: string): Promise<APIResponse> {
    return this.enviar('DELETE', `/usuarios/${id}`);
  }

  // ---- login
  login(email: string, password: string): Promise<APIResponse> {
    return this.enviar('POST', '/login', { data: { email, password } });
  }

  // ---- produtos
  criarProduto(dados: object, token?: string): Promise<APIResponse> {
    return this.enviar('POST', '/produtos', { data: dados, token });
  }
  buscarProduto(id: string): Promise<APIResponse> {
    return this.enviar('GET', `/produtos/${id}`);
  }
  listarProdutos(params: Record<string, string> = {}): Promise<APIResponse> {
    return this.enviar('GET', '/produtos', { params });
  }
  excluirProduto(id: string, token?: string): Promise<APIResponse> {
    return this.enviar('DELETE', `/produtos/${id}`, { token });
  }

  // ---- carrinhos
  criarCarrinho(produtos: ItemCarrinho[], token?: string): Promise<APIResponse> {
    return this.enviar('POST', '/carrinhos', { data: { produtos }, token });
  }
  concluirCompra(token?: string): Promise<APIResponse> {
    return this.enviar('DELETE', '/carrinhos/concluir-compra', { token });
  }
  cancelarCompra(token?: string): Promise<APIResponse> {
    return this.enviar('DELETE', '/carrinhos/cancelar-compra', { token });
  }
}
