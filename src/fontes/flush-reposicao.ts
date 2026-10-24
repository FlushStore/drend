/**
 * Reposição da Flush: os sabores acabando (os mesmos do bloco "Acabando") cruzados com o giro
 * de cada um, das vendas que a leitura já traz (do dia 1 do mês passado até hoje).
 *
 * O giro é por sabor: `sales` guarda `product_id` + `flavor_id` (e `flavor_name`). A venda casa
 * com o estoque pelo par de ids; sem `flavor_id` (venda antiga), pelo nome do produto + sabor.
 * Venda sem sabor nenhum não entra no giro de ninguém.
 *
 * Sugestão = venda prevista para a cobertura − estoque, arredondada para cima, mínimo 0.
 * A previsão é o que vendeu nos últimos N dias; se a leitura tem menos de N dias, a média dos
 * dias lidos vezes N. Nada aqui grava nem envia: o pedido só vira texto.
 */
import { diaLocal, ehVendaComercial, type VendaFlush } from "./flush-regras";
import { saboresAcabando, type SaborEstoqueFlush, type VinculoFlush } from "./flush-produtos";

export const COBERTURAS = [7, 14, 30] as const;
export type Cobertura = (typeof COBERTURAS)[number];
export const COBERTURA_PADRAO: Cobertura = 14;

export interface GiroDoSabor {
  id: string;
  produto: string;
  sabor: string;
  emoji: string;
  estoque: number;
  /** Unidades vendidas nos últimos 7, 14 e 30 dias (contando hoje). */
  vendidos: Record<Cobertura, number>;
}

export interface GiroFlush {
  itens: GiroDoSabor[];
  /** Quantos dias de venda a leitura cobre (o último é hoje). */
  diasLidos: number;
}

export interface LinhaDeReposicao {
  id: string;
  sabor: string;
  emoji: string;
  estoque: number;
  vendidos: number;
  sugestao: number;
}

export interface GrupoDeReposicao {
  produto: string;
  sabores: LinhaDeReposicao[];
}

export interface Reposicao {
  cobertura: Cobertura;
  /** Dias de venda usados (menor que a cobertura quando a leitura é mais curta). */
  janela: number;
  grupos: GrupoDeReposicao[];
  total: number;
  /** Sabores acabando que não venderam na janela (sugestão 0, ficam fora da lista). */
  semGiro: number;
}

const norma = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const porNome = (produto: string | null | undefined, sabor: string | null | undefined) => `${norma(produto)}|${norma(sabor)}`;

/** Giro dos sabores acabando nos últimos 7/14/30 dias de `dias` (dias locais em ordem, o último é hoje). */
export function calcularGiro(
  vendas: readonly VendaFlush[],
  estoque: { sabores: readonly SaborEstoqueFlush[]; vinculos: readonly VinculoFlush[] },
  dias: readonly string[],
): GiroFlush {
  const acabando = saboresAcabando(estoque.sabores, estoque.vinculos);
  const brutos = new Map(estoque.sabores.map((s) => [s.id, s]));
  const itens: GiroDoSabor[] = [];
  const porIds = new Map<string, GiroDoSabor>();
  const porNomes = new Map<string, GiroDoSabor>();
  for (const a of acabando) {
    const item: GiroDoSabor = { id: a.id, produto: a.produto, sabor: a.sabor, emoji: a.emoji, estoque: a.quantidade, vendidos: { 7: 0, 14: 0, 30: 0 } };
    itens.push(item);
    const b = brutos.get(a.id);
    if (b?.flavor_id) porIds.set(`${b.product_id}|${b.flavor_id}`, item);
    porNomes.set(porNome(a.produto, a.sabor), item);
  }

  // Dia → há quantos dias (0 = hoje), só para os últimos 30.
  const idade = new Map<string, number>();
  dias.slice(-30).reverse().forEach((d, i) => idade.set(d, i));

  for (const v of vendas) {
    if (!v.created_at || !ehVendaComercial(v)) continue;
    const ha = idade.get(diaLocal(v.created_at));
    if (ha === undefined) continue;
    const item = v.flavor_id
      ? porIds.get(`${v.product_id ?? ""}|${v.flavor_id}`)
      : v.flavor_name ? porNomes.get(porNome(v.product_name, v.flavor_name)) : undefined;
    if (!item) continue;
    const q = Number(v.quantity) || 0;
    for (const c of COBERTURAS) if (ha < c) item.vendidos[c] += q;
  }
  return { itens, diasLidos: Math.min(dias.length, 30) };
}

/** Sugestão de um sabor: previsão da cobertura − estoque, para cima, mínimo 0. */
export function sugestaoDe(vendidos: number, estoque: number, cobertura: number, janela: number): number {
  if (janela <= 0 || vendidos <= 0) return 0;
  const previsto = (vendidos * cobertura) / janela;
  // O epsilon segura 3 × 14 / 14 = 3.0000000001 de virar 4.
  return Math.max(0, Math.ceil(previsto - Math.max(0, estoque) - 1e-9));
}

/** A lista do pedido para a cobertura escolhida: produto (A→Z) → sabores (mais pedido primeiro). */
export function montarReposicao(giro: GiroFlush, cobertura: Cobertura): Reposicao {
  const janela = Math.min(cobertura, giro.diasLidos);
  const mapa = new Map<string, GrupoDeReposicao>();
  let total = 0;
  let semGiro = 0;
  for (const it of giro.itens) {
    const vendidos = it.vendidos[cobertura];
    const sugestao = sugestaoDe(vendidos, it.estoque, cobertura, janela);
    if (vendidos <= 0) semGiro += 1;
    if (sugestao <= 0) continue;
    const chave = norma(it.produto);
    const grupo = mapa.get(chave) ?? { produto: it.produto, sabores: [] };
    grupo.sabores.push({ id: it.id, sabor: it.sabor, emoji: it.emoji, estoque: it.estoque, vendidos, sugestao });
    mapa.set(chave, grupo);
    total += sugestao;
  }
  const grupos = [...mapa.values()]
    .map((g) => ({ ...g, sabores: g.sabores.sort((a, b) => b.sugestao - a.sugestao || a.sabor.localeCompare(b.sabor, "pt-BR")) }))
    .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));
  return { cobertura, janela, grupos, total, semGiro };
}

const unidades = (n: number) => (n === 1 ? "1 unidade" : `${n} unidades`);

/** O pedido em texto (WhatsApp entende o *negrito*). */
export function textoDoPedido(r: Reposicao): string {
  const linhas = [`Pedido de reposição (cobre ${r.cobertura} dias de venda)`];
  for (const g of r.grupos) {
    linhas.push("", `*${g.produto}*`);
    for (const s of g.sabores) linhas.push(`- ${s.sabor}: ${s.sugestao}`);
  }
  linhas.push("", `Total: ${unidades(r.total)}`);
  return linhas.join("\n");
}

export function linkDoWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function ehCobertura(v: unknown): v is Cobertura {
  return COBERTURAS.some((c) => String(c) === String(v));
}
