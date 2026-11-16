import { faker } from '@faker-js/faker';
import type { NovoProduto, NovoUsuario } from '../api/client';

// Sufixo único: os testes rodam em paralelo contra uma API compartilhada, então
// nenhum dado pode colidir com o de outro teste (ou de outra pessoa).
const sufixo = () => `${Date.now().toString(36)}${faker.string.alphanumeric(4)}`.toLowerCase();

export function novoUsuario(overrides: Partial<NovoUsuario> = {}): NovoUsuario {
  return {
    nome: faker.person.fullName(),
    email: `qa.${sufixo()}@teste.com`,
    password: faker.internet.password({ length: 10 }),
    administrador: 'false',
    ...overrides,
  };
}

export function novoProduto(overrides: Partial<NovoProduto> = {}): NovoProduto {
  return {
    nome: `Produto ${sufixo()}`,
    preco: faker.number.int({ min: 10, max: 5000 }),
    descricao: faker.commerce.productDescription(),
    quantidade: faker.number.int({ min: 1, max: 50 }),
    ...overrides,
  };
}
