/**
 * Leitura da Flush (projeto Supabase do painel da Flush). O DREND SÓ LÊ: nenhum insert,
 * update, delete ou RPC que grava. Entra com a conta de admin da Flush; a RLS de lá é
 * quem decide o que dá para ver, e a sessão fica só neste aparelho (não vai para o banco do DREND).
 *
 * URL e chave publicável são as mesmas que o app da Flush já publica no navegador.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resumirPorDia, ultimosDias, type CaixaFlush, type CustoPadrao, type DiaFlush, type VendaFlush } from "./flush-regras";

const URL_FLUSH = "https://yglmhmcqknjqoprilhwp.supabase.co";
const CHAVE_FLUSH = "sb_publishable_7CvVBFeEZYLSBmNnNinKmg_ln4n5qhD";
/** Flush Principal (Unaí). Samambaia é a ...0002. */
export const LOJA_PRINCIPAL = "5f1a9c00-0000-4000-8000-000000000001";
export const EMAIL_FLUSH = "flushstoreunai@gmail.com";
const CHAVE_RESUMO = "drend:flush:resumo";

let cliente: SupabaseClient | null = null;
function flush(): SupabaseClient {
  cliente ??= createClient(URL_FLUSH, CHAVE_FLUSH, { auth: { persistSession: true, storageKey: "drend:flush" } });
  return cliente;
}

export interface ResumoFlush {
  dias: DiaFlush[];
  atualizadoEm: string;
}

export type EstadoFlush =
  | { fase: "carregando" }
  | { fase: "fora" }
  | { fase: "erro"; mensagem: string; resumo: ResumoFlush | null }
  | { fase: "ok"; resumo: ResumoFlush; atualizando: boolean };

let estado: EstadoFlush = { fase: "carregando" };
// Sobe a cada desligar: uma leitura que termina depois disso é descartada.
let geracao = 0;
const ouvintes = new Set<() => void>();
function mudar(novo: EstadoFlush) {
  estado = novo;
  ouvintes.forEach((f) => f());
}
export const lerEstado = () => estado;
export function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function resumoGuardado(): ResumoFlush | null {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RESUMO) || "null") as ResumoFlush | null;
    return r && Array.isArray(r.dias) ? r : null;
  } catch {
    return null;
  }
}
function guardar(r: ResumoFlush | null) {
  try {
    if (r) localStorage.setItem(CHAVE_RESUMO, JSON.stringify(r));
    else localStorage.removeItem(CHAVE_RESUMO);
  } catch { /* sem armazenamento: segue sem cache */ }
}

/** Os últimos 7 dias da loja principal, com as regras do Início da Flush. */
export async function buscarSemana(agora = new Date()): Promise<ResumoFlush> {
  const dias = ultimosDias(7, agora);
  const inicio = new Date(`${dias[0]}T00:00:00`).toISOString();
  const db = flush();
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

export async function atualizar() {
  const minha = geracao;
  const anterior = estado.fase === "ok" ? estado.resumo : estado.fase === "erro" ? estado.resumo : resumoGuardado();
  if (anterior) mudar({ fase: "ok", resumo: anterior, atualizando: true });
  try {
    const resumo = await buscarSemana();
    if (minha !== geracao) return;
    guardar(resumo);
    mudar({ fase: "ok", resumo, atualizando: false });
  } catch (e) {
    if (minha !== geracao) return;
    mudar({ fase: "erro", mensagem: e instanceof Error ? e.message : "Falha ao ler a Flush", resumo: anterior });
  }
}

let iniciado = false;
/** Liga a leitura uma vez: se já há sessão da Flush neste aparelho, busca os números. */
export function iniciarFlush() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const guardado = resumoGuardado();
  void flush().auth.getSession().then(({ data }) => {
    if (!data.session) {
      guardar(null);
      mudar({ fase: "fora" });
      return;
    }
    if (guardado) mudar({ fase: "ok", resumo: guardado, atualizando: true });
    void atualizar();
  });
  // Volta para o app (iPhone): números frescos, no máximo a cada 2 minutos.
  let ultima = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || estado.fase === "fora" || Date.now() - ultima < 120_000) return;
    ultima = Date.now();
    void atualizar();
  });
}

/** Entra com a conta de admin da Flush. Devolve a mensagem de erro, ou null. */
export async function entrarNaFlush(email: string, senha: string): Promise<string | null> {
  const db = flush();
  const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) return error.message === "Invalid login credentials" ? "E-mail ou senha da Flush errados." : error.message;
  const { data: admin, error: erroAdmin } = await db.rpc("is_admin");
  if (erroAdmin || admin !== true) {
    await db.auth.signOut();
    return "Essa conta não é admin da Flush.";
  }
  await atualizar();
  return null;
}

export async function sairDaFlush() {
  geracao++;
  await flush().auth.signOut();
  guardar(null);
  mudar({ fase: "fora" });
}
