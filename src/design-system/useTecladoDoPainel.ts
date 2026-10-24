import { useEffect, type RefObject } from "react";

/**
 * Quanto do fundo da tela o teclado cobre: o que a janela tem abaixo da parte visível
 * (`visualViewport`). Menos de 80 px é barra do navegador mexendo, não teclado.
 */
export function alturaDoTeclado(alturaDaJanela: number, alturaVisivel: number, deslocamentoDoTopo: number): number {
  const coberto = Math.round(alturaDaJanela - alturaVisivel - deslocamentoDoTopo);
  return coberto >= 80 ? coberto : 0;
}

/**
 * Teclado do celular com a folha de baixo aberta (15/10, iPhone): a folha sobe e encolhe
 * para caber em cima do teclado, e o campo tocado rola para o meio da parte visível.
 * Substitui o `repositionInputs` do vaul, que no Safari deixava a folha cortada no meio,
 * com um vão vazio e a tela de trás aparecendo embaixo.
 */
export function useTecladoDoPainel(conteudo: RefObject<HTMLElement>, ativo: boolean) {
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!ativo || !vv) return;
    let quadro = 0;
    // O nó que recebeu os ajustes: a limpeza desfaz nele, mesmo que a ref já tenha mudado.
    let ajustado: HTMLElement | null = null;
    const ajustar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const el = conteudo.current;
        if (!el) return;
        ajustado = el;
        const teclado = alturaDoTeclado(window.innerHeight, vv.height, vv.offsetTop);
        if (teclado > 0) {
          el.style.bottom = `${teclado}px`;
          el.style.maxHeight = `${Math.max(240, vv.height - 8)}px`;
          el.dataset.teclado = "";
        } else {
          el.style.bottom = "";
          el.style.maxHeight = "";
          delete el.dataset.teclado;
        }
      });
    };
    let espera = 0;
    const aoFocar = (e: FocusEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo?.matches("input, textarea, select") || !conteudo.current?.contains(alvo)) return;
      // Depois de o teclado terminar de subir: o campo vai para o meio do que sobrou à vista.
      window.clearTimeout(espera);
      espera = window.setTimeout(() => alvo.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
    };
    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
    document.addEventListener("focusin", aoFocar);
    ajustar();
    return () => {
      cancelAnimationFrame(quadro);
      window.clearTimeout(espera);
      vv.removeEventListener("resize", ajustar);
      vv.removeEventListener("scroll", ajustar);
      document.removeEventListener("focusin", aoFocar);
      if (ajustado) { ajustado.style.bottom = ""; ajustado.style.maxHeight = ""; delete ajustado.dataset.teclado; }
    };
  }, [conteudo, ativo]);
}
