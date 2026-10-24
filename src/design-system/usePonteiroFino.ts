import { useSyncExternalStore } from "react";

/** Mouse ou trackpad (computador): gestos de arrastar do celular atrapalham a seleção de texto. */
export const CONSULTA_PONTEIRO_FINO = "(pointer: fine)";

function ler(): boolean {
  try {
    return window.matchMedia?.(CONSULTA_PONTEIRO_FINO).matches ?? false;
  } catch {
    return false;
  }
}

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(CONSULTA_PONTEIRO_FINO);
  mq.addEventListener?.("change", avisar);
  return () => mq.removeEventListener?.("change", avisar);
}

export function usePonteiroFino(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}
