/**
 * Agenda do Google, lida pela /api/agenda com o login do DREND (o endereço da agenda fica
 * só no servidor). Guarda a última leitura no aparelho: abre com a agenda mesmo sem internet.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/core/nuvem";
import type { Compromisso } from "@/core/agenda";

export type EstadoAgenda =
  | { fase: "sem-banco" | "fora" | "carregando" | "sem-agenda" }
  | { fase: "erro"; mensagem: string; eventos: Compromisso[] | null }
  | { fase: "ok"; eventos: Compromisso[]; atualizadoEm: string };

const CACHE = "drend:agenda";
let estado: EstadoAgenda = supabase ? { fase: "carregando" } : { fase: "sem-banco" };
const ouvintes = new Set<() => void>();
function mudar(novo: EstadoAgenda) {
  estado = novo;
  ouvintes.forEach((f) => f());
}
export const lerAgenda = () => estado;
function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function guardado(): { eventos: Compromisso[]; atualizadoEm: string } | null {
  try {
    const r = JSON.parse(localStorage.getItem(CACHE) || "null");
    return r && Array.isArray(r.eventos) ? r : null;
  } catch {
    return null;
  }
}
function guardar(r: { eventos: Compromisso[]; atualizadoEm: string } | null) {
  try {
    if (r) localStorage.setItem(CACHE, JSON.stringify(r));
    else localStorage.removeItem(CACHE);
  } catch { /* sem armazenamento: segue sem cache */ }
}

/** O que dizer quando a agenda não está lida. */
export function motivoSemAgenda(e: EstadoAgenda): string {
  if (e.fase === "sem-agenda") return "A agenda ainda não está ligada. O passo é colar o endereço secreto do Google Agenda na Vercel.";
  if (e.fase === "fora" || e.fase === "sem-banco") return "Entre na sua conta do DREND que eu leio a sua agenda.";
  if (e.fase === "carregando") return "Estou lendo a sua agenda. Pergunte de novo em instantes.";
  if (e.fase === "erro") return `Não consegui ler a agenda agora (${e.mensagem}).`;
  return "";
}

let ultima = 0;
export async function atualizarAgenda(forcar = false) {
  if (!supabase) return;
  if (!forcar && Date.now() - ultima < 5 * 60 * 1000 && estado.fase === "ok") return;
  ultima = Date.now();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    guardar(null);
    return mudar({ fase: "fora" });
  }
  const antes = estado.fase === "ok" ? estado.eventos : guardado()?.eventos ?? null;
  try {
    const r = await fetch(`/api/agenda${forcar ? "?forcar=1" : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 503 && corpo.codigo === "sem-agenda") return mudar({ fase: "sem-agenda" });
    if (!r.ok) throw new Error(corpo.erro || `erro ${r.status}`);
    guardar(corpo);
    mudar({ fase: "ok", eventos: corpo.eventos, atualizadoEm: corpo.atualizadoEm });
  } catch (e) {
    mudar({ fase: "erro", mensagem: e instanceof Error ? e.message : "sem resposta", eventos: antes });
  }
}

let ligado = false;
/** Lê uma vez ao abrir, de novo ao entrar ou voltar para o app (no máximo a cada 5 min). */
export function iniciarAgenda() {
  if (ligado || !supabase || typeof window === "undefined") return;
  ligado = true;
  const salvo = guardado();
  if (salvo) mudar({ fase: "ok", ...salvo });
  supabase.auth.onAuthStateChange((evento, sessao) => {
    if (!sessao) {
      guardar(null);
      mudar({ fase: "fora" });
    } else if (evento === "SIGNED_IN" || evento === "INITIAL_SESSION") void atualizarAgenda();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void atualizarAgenda();
  });
}

/** Eventos para as telas: os lidos agora ou, com erro, a última leitura. */
export const eventosDa = (e: EstadoAgenda): Compromisso[] | null => (e.fase === "ok" ? e.eventos : e.fase === "erro" ? e.eventos : null);

export function useAgenda(): EstadoAgenda {
  useEffect(iniciarAgenda, []);
  return useSyncExternalStore(ouvir, lerAgenda, lerAgenda);
}
