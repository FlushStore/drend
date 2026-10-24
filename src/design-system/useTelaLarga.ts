import { useSyncExternalStore } from "react";

/** Largura de "computador" do Control OS: abas no topo, painel lateral, sem doca. */
export const CONSULTA_TELA_LARGA = "(min-width: 1024px)";

function ler(): boolean {
  try {
    return window.matchMedia?.(CONSULTA_TELA_LARGA).matches ?? false;
  } catch {
    return false;
  }
}

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(CONSULTA_TELA_LARGA);
  mq.addEventListener?.("change", avisar);
  return () => mq.removeEventListener?.("change", avisar);
}

export function useTelaLarga(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}
