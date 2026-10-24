/** Regra do teclado numérico do balcão (pura; o componente é `TecladoNumerico`). */

/** Aplica uma tecla ao texto: uma vírgula só, no máximo `decimais` casas, zero à esquerda some, sete dígitos no inteiro. */
export function teclar(valor: string, tecla: string, decimais = 2): string {
  if (tecla === "apagar") return valor.slice(0, -1);
  if (tecla === ",") return valor.includes(",") ? valor : valor === "" ? "0," : `${valor},`;
  const [inteiro, centavos] = valor.split(",");
  if (centavos !== undefined) return centavos.length >= decimais ? valor : `${inteiro},${centavos}${tecla}`;
  if (inteiro === "0") return tecla;
  if (inteiro.length >= 7) return valor;
  return `${inteiro}${tecla}`;
}
