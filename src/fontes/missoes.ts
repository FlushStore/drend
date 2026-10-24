/**
 * Missões ao vivo: lê os eventos de `drend_missao` no banco do DREND e fica ouvindo os
 * novos pelo Realtime. Só funciona com o login do DREND (a RLS só deixa o Rapha ler).
 * Gravar é das IAs, pelo /api/missao, ou do Rapha pela conversa.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/core/nuvem";
import type { EventoMissao } from "@/core/missao";

export type EstadoMissoes =
  | { fase: "sem-banco" | "fora" | "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "ok"; eventos: EventoMissao[]; aoVivo: boolean; novo: number | null };

let estado: EstadoMissoes = supabase ? { fase: "carregando" } : { fase: "sem-banco" };
const ouvintes = new Set<() => void>();
function mudar(novo: EstadoMissoes) {
  estado = novo;
  ouvintes.forEach((f) => f());
}
export const lerMissoes = () => estado;
function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

let canal: RealtimeChannel | null = null;
const PAGINA = 1000;

/** O histórico inteiro, em páginas pela ordem de gravação (id): o estado do plano depende do último evento. */
async function buscarTudo(): Promise<EventoMissao[]> {
  const todos: EventoMissao[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase!.from("drend_missao").select("*").order("id", { ascending: true }).range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    todos.push(...((data ?? []) as EventoMissao[]));
    if (!data || data.length < PAGINA) return todos;
  }
}

/** Junta sem repetir (o mesmo evento pode vir do histórico e do Realtime). */
function juntar(a: readonly EventoMissao[], b: readonly EventoMissao[]): EventoMissao[] {
  const porId = new Map<number, EventoMissao>();
  for (const e of [...a, ...b]) porId.set(e.id, e);
  return [...porId.values()].sort((x, y) => x.id - y.id);
}

let geracao = 0;
async function carregar() {
  if (!supabase) return;
  const minha = ++geracao;
  // Primeiro o canal, depois o histórico: o que chegar no meio fica guardado e entra na junção.
  const chegaram: EventoMissao[] = [];
  let pronto = false;
  let aoVivo = false;
  let avisarCanal = () => {};
  const canalPronto = new Promise<void>((ok) => (avisarCanal = ok));
  canal?.unsubscribe();
  canal = supabase
    .channel(`drend-missao-${minha}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "drend_missao" }, (payload) => {
      if (minha !== geracao) return;
      const e = payload.new as EventoMissao;
      if (!pronto) {
        chegaram.push(e);
        return;
      }
      if (estado.fase !== "ok" || estado.eventos.some((x) => x.id === e.id)) return;
      mudar({ ...estado, eventos: juntar(estado.eventos, [e]), novo: e.id });
    })
    .subscribe((status) => {
      if (minha !== geracao) return;
      aoVivo = status === "SUBSCRIBED";
      if (status !== "CLOSED") avisarCanal();
      if (estado.fase === "ok") mudar({ ...estado, aoVivo });
    });
  // Só lê o histórico com o canal já ouvindo (ou desistindo dele em 5 s): nada cai no vão entre os dois.
  await Promise.race([canalPronto, new Promise<void>((ok) => setTimeout(ok, 5000))]);
  if (minha !== geracao) return;
  try {
    const historico = await buscarTudo();
    if (minha !== geracao) return;
    pronto = true;
    mudar({ fase: "ok", eventos: juntar(historico, chegaram), aoVivo, novo: null });
  } catch (e) {
    // Antes da migração 0003 a tabela não existe: o app segue sem a Central.
    if (minha === geracao) mudar({ fase: "erro", mensagem: e instanceof Error ? e.message : "Falha ao ler as missões" });
  }
}

let ligado = false;
function ligar() {
  if (ligado || !supabase) return;
  ligado = true;
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    if (!sessao) {
      geracao++;
      canal?.unsubscribe();
      canal = null;
      mudar({ fase: "fora" });
    } else if (estado.fase !== "ok") {
      void carregar();
    }
  });
  // Voltou para o app (iPhone suspende a conexão): relê para não perder nada do intervalo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && estado.fase === "ok") void carregar();
  });
}

/** Grava um evento como o Rapha (pela conversa). Devolve a mensagem de erro, ou null. */
export async function registrar(e: Pick<EventoMissao, "missao" | "tipo" | "titulo"> & Partial<Pick<EventoMissao, "chave" | "fase" | "texto">>): Promise<string | null> {
  if (!supabase) return "O banco do DREND não está ligado.";
  const { error } = await supabase.from("drend_missao").insert({ ...e, agente: "rapha" });
  return error ? error.message : null;
}

export function useMissoes(): EstadoMissoes {
  useEffect(ligar, []);
  return useSyncExternalStore(ouvir, lerMissoes, lerMissoes);
}
