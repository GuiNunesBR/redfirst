import { z } from 'zod';

// Contratos (schemas) das respostas da API. Se a API mudar o formato, os testes acusam.
export const MensagemSchema = z.object({ message: z.string() });

export const CadastroSchema = z.object({
  message: z.string(),
  _id: z.string().min(1),
});

export const LoginSchema = z.object({
  message: z.string(),
  authorization: z.string().startsWith('Bearer '),
});

export const UsuarioSchema = z.object({
  nome: z.string(),
  email: z.string(),
  password: z.string(),
  administrador: z.enum(['true', 'false']),
  _id: z.string(),
});

export const ProdutoSchema = z.object({
  nome: z.string(),
  preco: z.number(),
  descricao: z.string(),
  quantidade: z.number(),
  _id: z.string(),
});

export const ListaProdutosSchema = z.object({
  quantidade: z.number(),
  produtos: z.array(ProdutoSchema),
});

export const ListaUsuariosSchema = z.object({
  quantidade: z.number(),
  usuarios: z.array(UsuarioSchema),
});

/** Valida `dados` contra o schema e devolve o objeto tipado, com mensagem de erro legível. */
export function validar<T extends z.ZodType>(schema: T, dados: unknown): z.infer<T> {
  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    throw new Error(`Contrato inválido:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
