/**
 * Leitura da Flush (projeto Supabase do painel da Flush). O DREND SÓ LÊ: nenhum insert,
 * update, delete ou RPC que grava. Entra com a conta de admin da Flush; a RLS de lá é
 * quem decide o que dá para ver, e a sessão fica só neste aparelho (não vai para o banco do DREND).
 *
 * URL e chave publicável são as mesmas que o app da Flush já publica no navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resumirPorDia, ultimosDias, type CaixaFlush, type CustoPadrao, type VendaFlush } from "./flush-regras";
import { criarFonte, type EstadoLoja, type ResumoLoja } from "./loja";

/** Flush Principal (Unaí). Samambaia é a ...0002. */
export const LOJA_PRINCIPAL = "5f1a9c00-0000-4000-8000-000000000001";
export const EMAIL_FLUSH = "flushstoreunai@gmail.com";

export type ResumoFlush = ResumoLoja;
export type EstadoFlush = EstadoLoja;

/** Os últimos 7 dias da loja principal, com as regras do Início da Flush. */
export async function buscarSemana(db: SupabaseClient, agora = new Date()): Promise<ResumoFlush> {
  const dias = ultimosDias(7, agora);
  const inicio = new Date(`${dias[0]}T00:00:00`).toISOString();
  const [vendas, caixa, custos] = await Promise.all([
    db.from("sales")
      .select("final_price, created_at, order_id, product_name, cost_price, quantity, payment_method, cash_neutralized")
      .eq("store_id", LOJA_PRINCIPAL).gte("created_at", inicio).limit(5000),
    db.from("cash_register")
      .select("type, amount, description, created_at, reference_type, reference_id")
      .eq("store_id", LOJA_PRINCIPAL).eq("type", "saida").eq("reference_type", "sale")
      .ilike("description", "frete pago da venda:%").gte("created_at", inicio).limit(5000),
    // Tabela global (vale para as duas unidades).
    db.from("custos_padrao").select("modelo, custo, ordem").order("ordem", { ascending: true }).order("modelo", { ascending: true }),
  ]);
  const erro = vendas.error || caixa.error || custos.error;
  if (erro) throw new Error(erro.message);
  const tabela: CustoPadrao[] = [];
  for (const r of (custos.data ?? []) as Array<{ modelo: unknown; custo: unknown }>) {
    const modelo = String(r.modelo ?? "").trim().toLowerCase();
    const custo = Number(r.custo);
    if (modelo && Number.isFinite(custo)) tabela.push({ modelo, custo });
  }
  return {
    dias: resumirPorDia((vendas.data ?? []) as VendaFlush[], (caixa.data ?? []) as CaixaFlush[], tabela, dias),
    atualizadoEm: new Date().toISOString(),
  };
}

const fonte = criarFonte({
  nome: "Flush",
  url: "https://yglmhmcqknjqoprilhwp.supabase.co",
  chave: "sb_publishable_7CvVBFeEZYLSBmNnNinKmg_ln4n5qhD",
  sessao: "drend:flush",
  cache: "drend:flush:resumo",
  buscar: buscarSemana,
});

export const lerEstado = fonte.lerEstado;
export const ouvir = fonte.ouvir;
export const atualizar = fonte.atualizar;
export const iniciarFlush = fonte.iniciar;
export const entrarNaFlush = fonte.entrar;
export const sairDaFlush = fonte.sair;
