import { readFile } from 'node:fs/promises';
import { ADMIN_FILE } from '../config/paths';
import type { Booleano, ServeRestClient } from '../api/client';
import { CadastroSchema, LoginSchema, validar } from '../api/schemas';
import { novoUsuario } from '../data/factories';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  password: string;
  token: string;
}

/** Cria um usuário (admin ou cliente) pela API e já devolve o token de acesso. */
export async function criarUsuarioComSessao(api: ServeRestClient, administrador: Booleano): Promise<UsuarioSessao> {
  const dados = novoUsuario({ administrador });
  const cadastro = await api.criarUsuario(dados);
  if (cadastro.status() !== 201) {
    throw new Error(`Não foi possível criar o usuário: ${cadastro.status()} ${await cadastro.text()}`);
  }
  const { _id } = validar(CadastroSchema, await cadastro.json());
  const token = await obterToken(api, dados.email, dados.password);
  return { id: _id, nome: dados.nome, email: dados.email, password: dados.password, token };
}

export async function obterToken(api: ServeRestClient, email: string, password: string): Promise<string> {
  const login = await api.login(email, password);
  if (login.status() !== 200) {
    throw new Error(`Login falhou: ${login.status()} ${await login.text()}`);
  }
  return validar(LoginSchema, await login.json()).authorization;
}

/** Lê o admin criado pelo projeto "setup" (usado pelos testes de interface). */
export async function lerAdminDoSetup(): Promise<Omit<UsuarioSessao, 'token'>> {
  return JSON.parse(await readFile(ADMIN_FILE, 'utf-8'));
}
