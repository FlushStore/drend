/**
 * Banco do DREND (Supabase criado pela Vercel). Desligado quando o build não tem as chaves:
 * aí o app segue só com o que está no aparelho.
 *
 * Hoje sincroniza o retrato inteiro (uma linha por dono em `drend_estado`). Vale a última
 * gravação: é um painel de uma pessoa só, os aparelhos dele não brigam entre si.
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Retrato } from "./persistencia";

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const chave = (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave, { auth: { persistSession: true, storageKey: "drend:sessao" } }) : null;

export type { Session };

export async function baixar<M>(): Promise<Retrato<M> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("drend_estado").select("dados").maybeSingle();
  if (error) throw error;
  return (data?.dados as Retrato<M> | undefined) ?? null;
}

export async function subir<M>(r: Retrato<M>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("drend_estado").upsert({ dados: r, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}

/** Qual versão vale: a mais recente pelo carimbo `salvoEm`. Sem remoto, vale a local. */
export function maisRecente<M>(local: Retrato<M> | null, remoto: Retrato<M> | null): "local" | "remoto" | "nenhum" {
  if (!local && !remoto) return "nenhum";
  if (!remoto) return "local";
  if (!local) return "remoto";
  return remoto.salvoEm > local.salvoEm ? "remoto" : "local";
}
