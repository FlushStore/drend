/**
 * Leitura da Flush (projeto Supabase do painel da Flush). O DREND SÓ LÊ: nenhum insert,
 * update, delete ou RPC que grava. Entra com a conta de admin da Flush; a RLS de lá é
 * quem decide o que dá para ver, e a sessão fica só neste aparelho (não vai para o banco do DREND).
 *
 * URL e chave publicável são as mesmas que o app da Flush já publica no navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { inicioDoMesAnterior } from "@/core/financeiro";
import { diasDesde, resumirPorDia, type CaixaFlush, type CustoPadrao, type VendaFlush } from "./flush-regras";
import { criarFonte, type DiaLoja, type EstadoLoja, type ResumoLoja } from "./loja";
import { supabase as drend } from "@/core/nuvem";

/** Flush Principal (Unaí). Samambaia é a ...0002. */
export const LOJA_PRINCIPAL = "5f1a9c00-0000-4000-8000-000000000001";
export const EMAIL_FLUSH = "flushstoreunai@gmail.com";

export type ResumoFlush = ResumoLoja;
export type EstadoFlush = EstadoLoja;

const PAGINA = 1000;

/** Todas as linhas, em páginas: o Supabase corta cada resposta em 1000. */
async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) return linhas;
  }
}

/**
 * Do dia 1 do mês passado até hoje, na loja principal, com as regras do Início da Flush.
 * `dias` são os últimos 7 (Hoje e Negócios); `historico` é tudo (o mês e a comparação).
 */
export async function buscarSemana(db: SupabaseClient, agora = new Date()): Promise<ResumoFlush> {
  const dias = diasDesde(inicioDoMesAnterior(agora), agora);
  const inicio = new Date(`${dias[0]}T00:00:00`).toISOString();
  const [vendas, caixa, custos] = await Promise.all([
    todas<VendaFlush>((de, ate) =>
      db.from("sales")
        .select("id, final_price, created_at, order_id, product_name, cost_price, quantity, payment_method, cash_neutralized")
        .eq("store_id", LOJA_PRINCIPAL).gte("created_at", inicio)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(de, ate)),
    todas<CaixaFlush>((de, ate) =>
      db.from("cash_register")
        .select("id, type, amount, description, created_at, reference_type, reference_id")
        .eq("store_id", LOJA_PRINCIPAL).eq("type", "saida").eq("reference_type", "sale")
        .ilike("description", "frete pago da venda:%").gte("created_at", inicio)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(de, ate)),
    // Tabela global (vale para as duas unidades).
    db.from("custos_padrao").select("modelo, custo, ordem").order("ordem", { ascending: true }).order("modelo", { ascending: true }),
  ]);
  if (custos.error) throw new Error(custos.error.message);
  const tabela: CustoPadrao[] = [];
  for (const r of (custos.data ?? []) as Array<{ modelo: unknown; custo: unknown }>) {
    const modelo = String(r.modelo ?? "").trim().toLowerCase();
    const custo = Number(r.custo);
    if (modelo && Number.isFinite(custo)) tabela.push({ modelo, custo });
  }
  const historico = resumirPorDia(vendas, caixa, tabela, dias);
  return { dias: historico.slice(-7), historico, atualizadoEm: new Date().toISOString() };
}

/** A cópia que o servidor do DREND guarda (lida da Flush de hora em hora, só leitura). */
async function doServidor(): Promise<ResumoFlush | null> {
  if (!drend) return null;
  const { data } = await drend.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const r = await fetch("/api/flush", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (r.status === 404 || r.status === 401) return null;
  if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
  const corpo = (await r.json()) as { historico?: DiaLoja[]; lidoEm?: string };
  if (!Array.isArray(corpo.historico) || !corpo.historico.length || !corpo.lidoEm) return null;
  return { dias: corpo.historico.slice(-7), historico: corpo.historico, atualizadoEm: corpo.lidoEm, origem: "servidor" };
}

const fonte = criarFonte({
  nome: "Flush",
  url: "https://yglmhmcqknjqoprilhwp.supabase.co",
  chave: "sb_publishable_7CvVBFeEZYLSBmNnNinKmg_ln4n5qhD",
  sessao: "drend:flush",
  cache: "drend:flush:resumo",
  buscar: buscarSemana,
  doServidor,
});

export const lerEstado = fonte.lerEstado;
export const ouvir = fonte.ouvir;
export const atualizar = fonte.atualizar;
let ouvindoDrend = false;
/** Liga a leitura e, ao entrar no DREND depois de abrir o app, busca a cópia do servidor. */
export function iniciarFlush() {
  fonte.iniciar();
  if (ouvindoDrend || !drend || typeof window === "undefined") return;
  ouvindoDrend = true;
  drend.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_IN") void fonte.atualizar();
  });
}
export const entrarNaFlush = fonte.entrar;
export const sairDaFlush = fonte.sair;
