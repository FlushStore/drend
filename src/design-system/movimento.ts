import { useSyncExternalStore } from "react";
import type { Transition } from "motion/react";

/** Curva padrão do Control OS (igual a `--cos-curva` em tokens.css). */
export const CURVA = [0.2, 0.8, 0.2, 1] as const;

/** A mesma curva como texto, para `element.animate()` (Web Animations). */
export const CURVA_CSS = `cubic-bezier(${CURVA.join(",")})`;

/** Durações em ms (iguais a `--cos-rapido`, `--cos-medio` e `--cos-lento`). */
export const DURACAO = { rapido: 140, medio: 220, lento: 300 } as const;

/** Mola do indicador que desliza (segmentado, abas, doca). */
export const MOLA_INDICADOR: Transition = { type: "spring", stiffness: 520, damping: 40 };

/** Mola de ícones que giram/assentam (o + da doca). */
export const MOLA_ICONE: Transition = { type: "spring", stiffness: 420, damping: 26 };

/** Sem animação: usado quando a pessoa pede movimento reduzido. */
export const INSTANTANEO: Transition = { duration: 0 };

const CONSULTA = "(prefers-reduced-motion: reduce)";

function ler(): boolean {
  try {
    return window.matchMedia?.(CONSULTA).matches ?? false;
  } catch {
    return false;
  }
}

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener?.("change", avisar);
  return () => mq.removeEventListener?.("change", avisar);
}

/**
 * `true` quando o sistema pede movimento reduzido. Reage à troca em tempo real
 * (diferente do `useReducedMotion` do motion, que guarda a primeira leitura).
 */
export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}

/** Escolhe a transição respeitando o movimento reduzido. */
export const transicao = (reduzido: boolean, normal: Transition): Transition => (reduzido ? INSTANTANEO : normal);
