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

async function carregar() {
  if (!supabase) return;
  const { data, error } = await supabase.from("drend_missao").select("*").order("em", { ascending: true }).limit(2000);
  if (error) {
    // Antes da migração 0003 a tabela não existe: o app segue sem a Central.
    mudar({ fase: "erro", mensagem: error.message });
    return;
  }
  mudar({ fase: "ok", eventos: (data ?? []) as EventoMissao[], aoVivo: false, novo: null });
  canal?.unsubscribe();
  canal = supabase
    .channel("drend-missao")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "drend_missao" }, (payload) => {
      const e = payload.new as EventoMissao;
      if (estado.fase !== "ok" || estado.eventos.some((x) => x.id === e.id)) return;
      mudar({ ...estado, eventos: [...estado.eventos, e], novo: e.id });
    })
    .subscribe((status) => {
      if (estado.fase === "ok") mudar({ ...estado, aoVivo: status === "SUBSCRIBED" });
    });
}

let ligado = false;
function ligar() {
  if (ligado || !supabase) return;
  ligado = true;
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    if (!sessao) {
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
