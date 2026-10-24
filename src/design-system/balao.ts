/** Folga mínima entre o balão e a borda da tela. */
export const FOLGA_DO_BALAO = 8;

/**
 * De que lado o balão se ancora. Por padrão ele nasce na esquerda do alvo e
 * cresce para a direita; se assim passaria da borda (coluna Vendas em 320 px
 * com 10 vendas ou mais), ele se ancora na direita do alvo e cresce para a
 * esquerda — desde que caiba melhor desse lado.
 */
export function ladoDoBalao(alvo: { left: number; right: number }, larguraDoBalao: number, larguraDaTela: number, folga = FOLGA_DO_BALAO): "esquerda" | "direita" {
  const sobraNaDireita = larguraDaTela - folga - (alvo.left + larguraDoBalao);
  if (sobraNaDireita >= 0) return "esquerda";
  const sobraNaEsquerda = alvo.right - larguraDoBalao - folga;
  return sobraNaEsquerda > sobraNaDireita ? "direita" : "esquerda";
}
