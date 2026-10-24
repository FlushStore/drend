import { useLayoutEffect, useRef, useState } from "react";
import { CURVA_CSS, DURACAO, useMovimentoReduzido } from "./movimento";

/** Sair é um pouco mais rápido que entrar (quem fecha já decidiu). */
const SAIR_MS = 180;

/**
 * Abre e fecha um trecho animando a altura NOS DOIS SENTIDOS (polimento mobile, 14/10).
 * Fechado, o trecho fica `hidden`: fora da árvore de acessibilidade e sem ocupar espaço.
 * Ao fechar, ele encolhe primeiro e só então some; em movimento reduzido abre e fecha seco.
 *
 * Uso: `const { ref, hidden } = useRecolhivel<HTMLDivElement>(aberto)` e
 * `<div ref={ref} hidden={hidden}>`. O elemento não deve ter padding nem margem
 * verticais (a altura não chega a zero com eles): envolva o conteúdo se precisar.
 */
export function useRecolhivel<T extends HTMLElement>(aberto: boolean) {
  const ref = useRef<T>(null);
  const reduzido = useMovimentoReduzido();
  const [presente, setPresente] = useState(aberto);
  const vinhaFechado = useRef(!aberto);
  // Abrir mostra o trecho já neste render; fechar espera a animação terminar.
  if (aberto && !presente) setPresente(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animar = !reduzido && typeof el.animate === "function";
    const rodar = (de: string, para: string, duracao: number) => {
      el.style.overflow = "hidden";
      const a = el.animate([{ height: de, opacity: de === "0px" ? 0 : 1 }, { height: para, opacity: para === "0px" ? 0 : 1 }], {
        duration: duracao, easing: CURVA_CSS, fill: "forwards",
      });
      const limpar = () => { a.cancel(); el.style.overflow = ""; };
      return { a, limpar };
    };

    if (aberto) {
      if (!vinhaFechado.current) return;
      vinhaFechado.current = false;
      if (!animar) return;
      const { a, limpar } = rodar("0px", `${el.scrollHeight}px`, DURACAO.medio);
      a.onfinish = limpar;
      return limpar;
    }

    vinhaFechado.current = true;
    if (!presente) return;
    if (!animar) { setPresente(false); return; }
    const { a, limpar } = rodar(`${el.offsetHeight}px`, "0px", SAIR_MS);
    // Ao terminar, some; a limpeza (cancelar o fill) roda no commit que aplica o `hidden`, sem piscar.
    a.onfinish = () => setPresente(false);
    return limpar;
  }, [aberto, presente, reduzido]);

  return { ref, hidden: !presente };
}
