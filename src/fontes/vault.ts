/**
 * Os vaults Obsidian do Rapha, lidos pela /api/vault com o login do DREND. Uma tarefa agendada
 * copia as notas dos repositórios dos vaults no GitHub. Guarda o índice no aparelho: abre com
 * as notas mesmo sem internet. O texto inteiro de uma nota vem na hora em que ela abre.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/core/nuvem";
import { unir, type LeituraVault, type NotaInteira, type NotaVault } from "@/core/vault";

export type EstadoVault =
  | { fase: "sem-banco" | "fora" | "carregando" | "sem-vault" }
  | { fase: "erro"; mensagem: string; notas: NotaVault[] | null; vaults: LeituraVault[] }
  | { fase: "ok"; notas: NotaVault[]; vaults: LeituraVault[] };

const CACHE = "drend:vault";
let estado: EstadoVault = supabase ? { fase: "carregando" } : { fase: "sem-banco" };
const ouvintes = new Set<() => void>();
function mudar(novo: EstadoVault) {
  estado = novo;
  ouvintes.forEach((f) => f());
}
export const lerVault = () => estado;
function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

type Guardado = { notas: NotaVault[]; vaults: LeituraVault[] };
function guardado(): Guardado | null {
  try {
    const r = JSON.parse(localStorage.getItem(CACHE) || "null");
    return r && Array.isArray(r.notas) && Array.isArray(r.vaults) ? r : null;
  } catch {
    return null;
  }
}
function guardar(r: Guardado | null) {
  try {
    if (r) localStorage.setItem(CACHE, JSON.stringify(r));
    else localStorage.removeItem(CACHE);
  } catch { /* sem espaço: segue sem cache */ }
}

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** O que dizer quando o vault não está lido. */
export function motivoSemVault(e: EstadoVault): string {
  if (e.fase === "sem-vault") return "O vault ainda não sincronizou. As notas chegam do GitHub sozinhas, sem nada da sua parte.";
  if (e.fase === "fora" || e.fase === "sem-banco") return "Entre na sua conta do DREND que eu leio o seu vault.";
  if (e.fase === "carregando") return "Estou lendo o seu vault. Pergunte de novo em instantes.";
  if (e.fase === "erro") return `Não consegui ler o vault agora (${e.mensagem}).`;
  return "";
}

const inteiras = new Map<string, NotaInteira>();
let ultima = 0;
export async function atualizarVault(forcar = false) {
  if (!supabase) return;
  if (!forcar && Date.now() - ultima < 10 * 60 * 1000 && estado.fase === "ok") return;
  ultima = Date.now();
  const t = await token();
  if (!t) {
    guardar(null);
    return mudar({ fase: "fora" });
  }
  const antes = estado.fase === "ok" ? estado : guardado();
  try {
    const r = await fetch("/api/vault", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 503 && corpo.codigo === "sem-vault") return mudar({ fase: "sem-vault" });
    if (!r.ok) throw new Error(corpo.erro || `erro ${r.status}`);
    const novo = { notas: unir(corpo.notas), vaults: corpo.vaults };
    // Índice novo pode trazer nota mudada: o texto das notas já abertas é lido de novo.
    inteiras.clear();
    guardar(novo);
    mudar({ fase: "ok", ...novo });
  } catch (e) {
    mudar({ fase: "erro", mensagem: e instanceof Error ? e.message : "sem resposta", notas: antes?.notas ?? null, vaults: antes?.vaults ?? [] });
  }
}

/** A nota inteira, com o texto. Lida uma vez por sessão. */
export async function abrirNota(n: Pick<NotaVault, "vault" | "caminho">): Promise<NotaInteira> {
  const chave = `${n.vault}/${n.caminho}`;
  const salva = inteiras.get(chave);
  if (salva) return salva;
  const t = await token();
  if (!t) throw new Error("entre na sua conta do DREND");
  const r = await fetch(`/api/vault?vault=${encodeURIComponent(n.vault)}&caminho=${encodeURIComponent(n.caminho)}`, { headers: { Authorization: `Bearer ${t}` } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || `erro ${r.status}`);
  inteiras.set(chave, corpo);
  return corpo;
}

/** Busca no texto das notas (no servidor): acha o que o índice não tem. */
export async function buscarNoTexto(termo: string): Promise<NotaVault[]> {
  const t = await token();
  if (!t) throw new Error("entre na sua conta do DREND");
  const r = await fetch(`/api/vault?q=${encodeURIComponent(termo)}`, { headers: { Authorization: `Bearer ${t}` } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || `erro ${r.status}`);
  return unir(corpo.notas);
}

let ligado = false;
/** Lê ao abrir, ao entrar e ao voltar para o app (no máximo a cada 10 min). */
export function iniciarVault() {
  if (ligado || !supabase || typeof window === "undefined") return;
  ligado = true;
  const salvo = guardado();
  if (salvo) mudar({ fase: "ok", ...salvo });
  supabase.auth.onAuthStateChange((evento, sessao) => {
    if (!sessao) {
      guardar(null);
      inteiras.clear();
      mudar({ fase: "fora" });
    } else if (evento === "SIGNED_IN" || evento === "INITIAL_SESSION") void atualizarVault();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void atualizarVault();
  });
}

/** As notas para as telas: as lidas agora ou, com erro, a última leitura. */
export const notasDo = (e: EstadoVault): NotaVault[] | null => (e.fase === "ok" ? e.notas : e.fase === "erro" ? e.notas : null);

export function useVault(): EstadoVault {
  useEffect(iniciarVault, []);
  return useSyncExternalStore(ouvir, lerVault, lerVault);
}
