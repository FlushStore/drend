import { useEffect, type RefObject } from "react";

/**
 * Sinal de "tem mais para o lado" (auditoria visual de 16/10: "Comp", "Tu" cortados sem
 * indicação). Marca o contêiner com `data-mais-esq` / `data-mais-dir` quando há conteúdo
 * escondido daquele lado; o CSS esmaece a borda correspondente. Sem rolagem, nada muda.
 */
export function useBordaDeRolagem(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const marcar = () => {
      const fim = el.scrollWidth - el.clientWidth;
      el.toggleAttribute("data-mais-esq", el.scrollLeft > 2);
      el.toggleAttribute("data-mais-dir", fim - el.scrollLeft > 2);
    };
    marcar();
    el.addEventListener("scroll", marcar, { passive: true });
    const observador = typeof ResizeObserver === "function" ? new ResizeObserver(marcar) : null;
    observador?.observe(el);
    return () => { el.removeEventListener("scroll", marcar); observador?.disconnect(); };
  }, [ref]);
}
