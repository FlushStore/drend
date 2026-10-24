import { useEffect, useRef, type RefObject } from "react";

/**
 * Segurar o dedo (ou o botão do mouse) parado sobre um elemento dispara uma ação, como
 * na tela de início do iPhone (15/10: segurar um widget do Início entra no modo de montar).
 * Andar mais que `TOLERANCIA_PX` (rolagem) ou soltar antes cancela. Depois de disparar, o
 * clique que viria ao soltar é engolido (o link do card não abre) e o menu do sistema
 * (copiar link, prévia) não aparece.
 */
const TOLERANCIA_PX = 10;
export const SEGURAR_MS = 520;

export function useSegurar<T extends HTMLElement>(ref: RefObject<T>, { ligado, aoSegurar, ms = SEGURAR_MS }: { ligado: boolean; aoSegurar: () => void; ms?: number }) {
  const acao = useRef(aoSegurar);
  acao.current = aoSegurar;
  useEffect(() => {
    const el = ref.current;
    if (!el || !ligado) return;
    let toque: { id: number; x: number; y: number; relogio: number } | null = null;
    let disparou = false;
    const parar = () => { if (toque) window.clearTimeout(toque.relogio); toque = null; };
    const baixo = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      parar();
      disparou = false;
      const relogio = window.setTimeout(() => {
        toque = null;
        disparou = true;
        navigator.vibrate?.(12);
        acao.current();
      }, ms);
      toque = { id: e.pointerId, x: e.clientX, y: e.clientY, relogio };
    };
    const mover = (e: PointerEvent) => {
      if (toque && e.pointerId === toque.id && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > TOLERANCIA_PX) parar();
    };
    const clique = (e: MouseEvent) => { if (disparou) { e.preventDefault(); e.stopPropagation(); disparou = false; } };
    const menu = (e: Event) => { if (toque || disparou) e.preventDefault(); };
    el.addEventListener("pointerdown", baixo, { passive: true });
    el.addEventListener("pointermove", mover, { passive: true });
    el.addEventListener("pointerup", parar);
    el.addEventListener("pointercancel", parar);
    el.addEventListener("click", clique, true);
    el.addEventListener("contextmenu", menu);
    window.addEventListener("scroll", parar, { passive: true, capture: true });
    return () => {
      parar();
      el.removeEventListener("pointerdown", baixo);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", parar);
      el.removeEventListener("pointercancel", parar);
      el.removeEventListener("click", clique, true);
      el.removeEventListener("contextmenu", menu);
      window.removeEventListener("scroll", parar, { capture: true });
    };
  }, [ref, ligado, ms]);
}
