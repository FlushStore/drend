/**
 * Regras de faturamento e lucro da Flush, copiadas do painel (puff-power-panel) para o DREND
 * mostrar o MESMO número que o Início do Control OS. Fontes, em 24/10/2026:
 * - `lib/resumo-de-vendas.ts` (resumirVendas, somarFrete, lucroDescontandoFrete)
 * - `lib/finance-utils.ts` (filterExcludedDates, resolveUnitCost, classificarFrete)
 * - `lib/venda-comercial.ts` (brinde e venda neutralizada ficam fora)
 * - `lib/custos-padrao.ts` (getProductCost: casamento exato, depois parcial na ordem)
 * Se a regra mudar lá, muda aqui. Nada aqui grava: o DREND só lê.
 */

export interface VendaFlush {
  final_price: number | string | null;
  created_at: string | null;
  order_id: string | null;
  product_name: string | null;
  cost_price: number | string | null;
  quantity: number | string | null;
  payment_method?: string | null;
  cash_neutralized?: boolean | null;
  /** Para o giro por sabor (reposição). */
  product_id?: string | null;
  flavor_id?: string | null;
  flavor_name?: string | null;
}

export interface CaixaFlush {
  type: string | null;
  amount: number | string | null;
  description: string | null;
  created_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
}

export interface CustoPadrao {
  modelo: string;
  custo: number;
}

/** Datas fora das contas (dados de antes do sistema). */
const DATAS_EXCLUIDAS = new Set(["2026-04-21", "2026-04-22"]);
const FRETE_PAGO = /^\s*frete pago da venda\s*:/i;

/** Dia local (o aparelho do Rapha está em Brasília) no formato AAAA-MM-DD. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ehVendaComercial(v: VendaFlush): boolean {
  if (v.cash_neutralized) return false;
  if (v.payment_method === "brinde") return false;
  return !(v.created_at && DATAS_EXCLUIDAS.has(diaLocal(v.created_at)));
}

export function custoPadraoDe(tabela: readonly CustoPadrao[]) {
  const exato = new Map(tabela.map((c) => [c.modelo, c.custo]));
  return (produto: string): number => {
    const chave = (produto || "").trim().toLowerCase();
    if (!chave) return 0;
    const achou = exato.get(chave);
    if (achou !== undefined) return achou;
    for (const { modelo, custo } of tabela) if (chave.includes(modelo) || modelo.includes(chave)) return custo;
    return 0;
  };
}

/** Custo da venda: o gravado nela; sem ele, o custo padrão do modelo. */
function custoDaLinha(v: VendaFlush, padrao: (p: string) => number): number {
  const unit = Number(v.cost_price) || 0;
  const custo = unit > 0 ? unit : Number(padrao(v.product_name || "")) || 0;
  return custo * (Number(v.quantity) || 1);
}

/** Frete que a loja pagou nas vendas (sai do lucro). O da venda neutralizada não conta. */
export function fretePago(caixa: readonly CaixaFlush[], vendas: readonly VendaFlush[]): number {
  const neutralizados = new Set(vendas.filter((v) => v.cash_neutralized && v.order_id).map((v) => v.order_id));
  let pago = 0;
  for (const r of caixa) {
    if (String(r.reference_type || "").toLowerCase() !== "sale" || !r.reference_id) continue;
    if (String(r.type || "").toLowerCase() !== "saida" || !FRETE_PAGO.test(r.description || "")) continue;
    if (neutralizados.has(r.reference_id)) continue;
    const v = Number(r.amount) || 0;
    if (v > 0) pago += v;
  }
  return Math.round(pago * 100) / 100;
}

export interface DiaFlush {
  dia: string;
  valor: number;
  lucro: number;
  pedidos: number;
}

/** Um resumo por dia, do mais antigo para hoje. Dias sem venda aparecem com zero. */
export function resumirPorDia(vendas: readonly VendaFlush[], caixa: readonly CaixaFlush[], custos: readonly CustoPadrao[], dias: readonly string[]): DiaFlush[] {
  const padrao = custoPadraoDe(custos);
  return dias.map((dia) => {
    const doDia = vendas.filter((v) => v.created_at && diaLocal(v.created_at) === dia);
    const validas = doDia.filter(ehVendaComercial);
    const valor = validas.reduce((s, v) => s + (Number(v.final_price) || 0), 0);
    const custo = validas.reduce((s, v) => s + custoDaLinha(v, padrao), 0);
    const frete = fretePago(caixa.filter((c) => c.created_at && diaLocal(c.created_at) === dia), doDia);
    const pedidos = new Set(validas.map((v) => v.order_id || `${v.created_at}${v.product_name}`)).size;
    return { dia, valor: Math.round(valor * 100) / 100, lucro: Math.round((valor - custo - frete) * 100) / 100, pedidos };
  });
}

/** Os últimos `n` dias locais, hoje por último. */
export function ultimosDias(n: number, agora = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(agora);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1 - i));
    return diaLocal(d.toISOString());
  });
}

/** Cada dia local de `inicio` (AAAA-MM-DD) até hoje, em ordem. */
export function diasDesde(inicio: string, agora = new Date()): string[] {
  const fim = diaLocal(agora.toISOString());
  const d = new Date(`${inicio}T12:00:00`);
  const dias: string[] = [];
  for (let dia = diaLocal(d.toISOString()); dia <= fim && dias.length < 400; dia = diaLocal(d.toISOString())) {
    dias.push(dia);
    d.setDate(d.getDate() + 1);
  }
  return dias;
}
