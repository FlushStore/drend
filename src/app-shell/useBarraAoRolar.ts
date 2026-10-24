import { useEffect, useRef, useState } from "react";

const DELTA_MINIMO = 8;
const DISTANCIA_DO_TOPO = 56;

interface Opcoes {
  /** Elemento de rolagem; padrão: window. */
  elemento?: HTMLElement | null;
  /** Mantém visível (ex.: teclado aberto, edição ativa). */
  forcarVisivel?: boolean;
}

/** `visivel`: esconde ao rolar para baixo, mostra ao subir ou perto do topo. A animação é do CSS. */
export function useBarraAoRolar({ elemento, forcarVisivel = false }: Opcoes = {}): boolean {
  const [visivel, setVisivel] = useState(true);
  const ultimo = useRef(0);

  useEffect(() => {
    const alvo: HTMLElement | Window = elemento ?? window;
    const posicao = () => (elemento ? elemento.scrollTop : window.scrollY);
    ultimo.current = posicao();
    let quadro: number | null = null;

    const medir = () => {
      quadro = null;
      const y = Math.max(0, posicao());
      const delta = y - ultimo.current;
      if (y <= DISTANCIA_DO_TOPO) {
        setVisivel(true);
        ultimo.current = y;
      } else if (Math.abs(delta) >= DELTA_MINIMO) {
        setVisivel(delta < 0);
        ultimo.current = y;
      }
    };
    const aoRolar = () => {
      if (quadro === null) quadro = requestAnimationFrame(medir);
    };

    alvo.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      alvo.removeEventListener("scroll", aoRolar);
      if (quadro !== null) cancelAnimationFrame(quadro);
    };
  }, [elemento]);

  return forcarVisivel || visivel;
}
