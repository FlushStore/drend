/** Igual ao `moneyBRL` da loja da Flush. */
export function moneyBRL(n: number) {
  const v = Number(n || 0);
  const [inteiro, decimais] = Math.abs(v).toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${v < 0 ? "-" : ""}${agrupado},${decimais}`;
}
