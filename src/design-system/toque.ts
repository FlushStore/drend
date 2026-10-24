import { useEffect } from "react";

/**
 * Vibração curta de confirmação (fase Fluidez, 14/10). Só onde o navegador deixa (Android);
 * o Safari do iPhone não tem `navigator.vibrate` e fica só a animação. Nunca em erro.
 */
export function vibrarConfirmacao(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* sem vibração neste aparelho */
  }
}

/** Vibra quando `chave` passa a existir ou muda (uma confirmação nova). */
export function useVibrarAoConfirmar(chave: string | number | null | undefined): void {
  useEffect(() => {
    if (chave !== null && chave !== undefined && chave !== "") vibrarConfirmacao();
  }, [chave]);
}
