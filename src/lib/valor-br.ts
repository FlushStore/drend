/** Leitura de valor digitado em reais. Pura: telas importam daqui sem puxar o banco. */

/**
 * "1.250", "1.250,00", "R$ 50,00", "12.5" → número. Ponto é milhar quando há
 * vírgula ou quando forma grupos de 3 sem vírgula ("1.250"); senão é decimal.
 * Antes "1.250" virava 1,25 no campo de troco (10/09/2026). Negativo e espaço
 * entre dígitos → `undefined` (16/10/2026).
 */
export function lerValorBR(texto: string | undefined): number | undefined {
  // Dinheiro digitado nunca é negativo, e espaço entre dígitos ("1 5") é engano de
  // digitação: os dois são recusados em vez de virar 5 ou 15 (ATLAS-VM-0002, item 10).
  const bruto = (texto ?? "").trim().replace(/^R\$\s*/i, "");
  if (/-/.test(bruto) || /\d\s+[\d,.]|[,.]\s+\d/.test(bruto)) return undefined;
  const limpo = bruto.replace(/[^\d,.]/g, "");
  if (!limpo) return undefined;
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, "") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

/** "50", "R$ 50,00", "1.250" → 50 / 1250; vazio/inválido → undefined (a RPC valida de novo). */
export function trocoParaNumero(texto: string | undefined): number | undefined {
  const n = lerValorBR(texto);
  return n !== undefined && n >= 0 ? n : undefined;
}
