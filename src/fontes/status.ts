/**
 * Saúde da Vape Mania: o site responde? o banco responde? O DREND não lê dados dela
 * (não é loja do Rapha), só bate na porta. Sem login e sem gravar nada.
 */
import { useEffect, useSyncExternalStore } from "react";

const SITE_VM = "https://vape-mania.pages.dev/";
const BANCO_VM = "https://fdjwqxpjlozrehhlqvhe.supabase.co/auth/v1/health";
const CHAVE_VM = "sb_publishable_Y4kJkVTPam01cXvueOr9NA_fl6WZjkD";
const LIMITE_MS = 8000;

export interface Servico {
  /** null enquanto não mediu. */
  ok: boolean | null;
  ms: number | null;
}

export interface StatusVM {
  site: Servico;
  banco: Servico;
  verificadoEm: string | null;
  verificando: boolean;
}

type Busca = (url: string, init?: RequestInit) => Promise<Response>;

/** Mede uma chamada: ok quando responde dentro do limite. */
export async function medir(chamar: (sinal: AbortSignal) => Promise<boolean>, agora: () => number = () => performance.now()): Promise<Servico> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITE_MS);
  const inicio = agora();
  try {
    const ok = await chamar(ctrl.signal);
    return { ok, ms: Math.round(agora() - inicio) };
  } catch {
    return { ok: false, ms: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function verificarVM(buscar: Busca = fetch): Promise<Pick<StatusVM, "site" | "banco">> {
  const [site, banco] = await Promise.all([
    // O site não libera CORS: "no-cors" só diz se respondeu, e é isso que importa aqui.
    medir((signal) => buscar(SITE_VM, { mode: "no-cors", cache: "no-store", signal }).then(() => true)),
    medir((signal) => buscar(BANCO_VM, { headers: { apikey: CHAVE_VM }, cache: "no-store", signal }).then((r) => r.ok)),
  ]);
  return { site, banco };
}

/** Uma linha para a tela: "No ar · 240 ms", "Fora do ar", "Verificando". */
export function rotulo(s: Servico, nome: "site" | "banco"): string {
  if (s.ok === null) return "Verificando";
  if (!s.ok) return nome === "site" ? "Fora do ar" : "Sem resposta";
  const tempo = s.ms !== null ? ` · ${s.ms} ms` : "";
  return (nome === "site" ? "No ar" : "Ok") + tempo;
}

let estado: StatusVM = { site: { ok: null, ms: null }, banco: { ok: null, ms: null }, verificadoEm: null, verificando: false };
const ouvintes = new Set<() => void>();
function mudar(novo: StatusVM) {
  estado = novo;
  ouvintes.forEach((f) => f());
}
export const lerStatusVM = () => estado;
function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

let ultima = 0;
/** Verifica de novo se a última foi há mais de 1 minuto. */
export async function atualizarStatusVM(forcar = false) {
  if (estado.verificando || (!forcar && Date.now() - ultima < 60_000)) return;
  ultima = Date.now();
  mudar({ ...estado, verificando: true });
  const r = await verificarVM();
  mudar({ ...r, verificadoEm: new Date().toISOString(), verificando: false });
}

let ligado = false;
function ligar() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void atualizarStatusVM();
  });
}

export function useStatusVM(): StatusVM {
  useEffect(() => {
    ligar();
    void atualizarStatusVM();
  }, []);
  return useSyncExternalStore(ouvir, lerStatusVM, lerStatusVM);
}
