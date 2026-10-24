/**
 * Produtos e estoque da Flush, com as regras do painel (puff-power-panel), em 24/10/2026:
 * - mais vendidos: `lib/ranking-de-produtos.ts` (agrupa pelo nome sem caixa nem espaço nas pontas,
 *   unidades = Σ quantity, faturamento = Σ final_price; empate: faturamento, depois o nome);
 * - sabores acabando: `features/inicio/api.ts` (carregarSaboresAcabando: `product_flavors` com
 *   `is_external = false` e `qty ≤ LIMITE_PADRAO_ACABANDO` (2), só de produto que vende na unidade:
 *   vínculo ativo + produto ativo + preço > 0, ver `produtoVendavel`/`precoVendavel`);
 * - por forma de pagamento: `features/financeiro/regras.ts` (porMeio: Σ final_price por
 *   `payment_method` nas vendas comerciais), rótulos de `lib/payment-methods.ts`.
 * Venda válida é a mesma de `flush-regras.ts` (sem neutralizada, sem brinde, sem as datas excluídas).
 * Só agrega o que veio da leitura: nada aqui inventa número.
 */
import { diaLocal, ehVendaComercial, type VendaFlush } from "./flush-regras";
import type { GiroFlush } from "./flush-reposicao";

/** O limite do "Sabores acabando" do Início da Flush (`LIMITE_PADRAO_ACABANDO`). */
export const LIMITE_ACABANDO = 2;

type Talvez<T> = T | T[] | null | undefined;
/** O Supabase devolve a relação embutida como objeto (ou lista, conforme o tipo inferido). */
const um = <T>(x: Talvez<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

/** Linha de `product_flavors` (o estoque é por sabor e por unidade). */
export interface SaborEstoqueFlush {
  id: string;
  product_id: string;
  /** Para casar com o sabor da venda (reposição). */
  flavor_id?: string | null;
  qty: number | string | null;
  is_external?: boolean | null;
  flavors?: Talvez<{ name: string | null; emoji?: string | null }>;
}

/** Linha de `store_products` (o produto habilitado na unidade), com o produto global. */
export interface VinculoFlush {
  product_id: string;
  active: boolean | null;
  price: number | string | null;
  products?: Talvez<{ name: string | null; active: boolean | null; price: number | string | null }>;
}

export interface ProdutoVendido {
  nome: string;
  unidades: number;
  faturamento: number;
}

export interface SaborAcabandoFlush {
  id: string;
  produto: string;
  sabor: string;
  emoji: string;
  quantidade: number;
}

export interface FormaDePagamento {
  forma: string;
  rotulo: string;
  valor: number;
  /** 0..1 do total do mês. */
  parte: number;
}

export interface ProdutosFlush {
  /** Os 7 dias locais das vendas (o último é hoje). */
  dias: string[];
  maisVendidos: ProdutoVendido[];
  /** null quando a leitura do estoque falhou (as vendas seguem). */
  acabando: SaborAcabandoFlush[] | null;
  /** AAAA-MM do mês corrente. */
  mes: string;
  formas: FormaDePagamento[];
  /** Giro dos sabores acabando, para a reposição. null quando o estoque não veio; ausente em resumo antigo. */
  giro?: GiroFlush | null;
}

const centavos = (v: number) => Math.round(v * 100);

/** Top `limite` por unidades nas vendas válidas dos `dias` informados. */
export function maisVendidos(vendas: readonly VendaFlush[], dias: readonly string[], limite = 5): ProdutoVendido[] {
  const nosDias = new Set(dias);
  const mapa = new Map<string, { nome: string; unidades: number; faturamento: number }>();
  for (const v of vendas) {
    if (!v.created_at || !nosDias.has(diaLocal(v.created_at)) || !ehVendaComercial(v)) continue;
    const nome = (v.product_name || "Sem nome").trim();
    const chave = nome.toLowerCase();
    const atual = mapa.get(chave) ?? { nome, unidades: 0, faturamento: 0 };
    atual.unidades += Number(v.quantity) || 0;
    atual.faturamento += centavos(Number(v.final_price) || 0);
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .filter((p) => p.unidades > 0)
    .map((p) => ({ nome: p.nome, unidades: p.unidades, faturamento: p.faturamento / 100 }))
    .sort((a, b) => b.unidades - a.unidades || b.faturamento - a.faturamento || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}

/** Preço que vende: o da unidade se > 0, senão o global se > 0 (`precoVendavel`). */
function temPreco(local: unknown, global: unknown): boolean {
  const l = Number(local);
  if (Number.isFinite(l) && l > 0) return true;
  const g = Number(global);
  return Number.isFinite(g) && g > 0;
}

/** Sabores de estoque próprio com até `limite` unidades, de produto que vende. Do menor para o maior. */
export function saboresAcabando(sabores: readonly SaborEstoqueFlush[], vinculos: readonly VinculoFlush[], limite = LIMITE_ACABANDO): SaborAcabandoFlush[] {
  const vendaveis = new Map<string, string>();
  for (const v of vinculos) {
    const p = um(v.products);
    if (v.active && p?.active && temPreco(v.price, p.price)) vendaveis.set(v.product_id, (p.name || "Produto sem nome").trim());
  }
  const itens: SaborAcabandoFlush[] = [];
  for (const s of sabores) {
    if (s.is_external) continue;
    const produto = vendaveis.get(s.product_id);
    const qtd = Number(s.qty);
    if (produto === undefined || !Number.isFinite(qtd) || qtd > limite) continue;
    const sabor = um(s.flavors);
    itens.push({ id: s.id, produto, sabor: (sabor?.name || "Sabor sem nome").trim(), emoji: sabor?.emoji || "", quantidade: Math.max(0, qtd) });
  }
  return itens.sort((a, b) => a.quantidade - b.quantidade || a.produto.localeCompare(b.produto, "pt-BR") || a.sabor.localeCompare(b.sabor, "pt-BR"));
}

const ROTULOS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão",
  cartao_credito: "Cartão de crédito",
  cartao: "Cartão",
  fiado: "Fiado",
  terceiro: "Empréstimo de terceiro",
};

export function rotuloDaForma(forma: string): string {
  return ROTULOS[forma] ?? (forma === "sem forma" ? "Sem forma" : forma.charAt(0).toUpperCase() + forma.slice(1).replace(/_/g, " "));
}

/** Vendas válidas do mês `mes` (AAAA-MM) por forma de pagamento, da maior para a menor. */
export function vendasPorForma(vendas: readonly VendaFlush[], mes: string): FormaDePagamento[] {
  const mapa = new Map<string, number>();
  for (const v of vendas) {
    if (!v.created_at || !diaLocal(v.created_at).startsWith(`${mes}-`) || !ehVendaComercial(v)) continue;
    const forma = (v.payment_method || "").trim() || "sem forma";
    mapa.set(forma, (mapa.get(forma) ?? 0) + centavos(Number(v.final_price) || 0));
  }
  const total = [...mapa.values()].reduce((s, c) => s + c, 0);
  return [...mapa]
    .filter(([, c]) => c !== 0)
    .map(([forma, c]) => ({ forma, rotulo: rotuloDaForma(forma), valor: c / 100, parte: total > 0 ? c / total : 0 }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Os três recortes juntos: semana (`dias`), estoque e o mês de hoje. */
export function resumirProdutos(
  vendas: readonly VendaFlush[],
  estoque: { sabores: readonly SaborEstoqueFlush[]; vinculos: readonly VinculoFlush[] } | null,
  dias: readonly string[],
  agora = new Date(),
): ProdutosFlush {
  const mes = diaLocal(agora.toISOString()).slice(0, 7);
  return {
    dias: [...dias],
    maisVendidos: maisVendidos(vendas, dias),
    acabando: estoque ? saboresAcabando(estoque.sabores, estoque.vinculos) : null,
    mes,
    formas: vendasPorForma(vendas, mes),
  };
}
