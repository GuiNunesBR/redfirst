export function brl(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
