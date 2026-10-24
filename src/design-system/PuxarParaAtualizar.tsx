import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { useMovimentoReduzido } from "./movimento";
import "./puxar.css";

export interface PuxarParaAtualizarProps {
  /** Só no celular. */
  ligado: boolean;
  /** Relê a tela; o indicador gira até a promessa terminar. */
  aoAtualizar: () => Promise<void>;
  /** Só puxa quando o dedo começa dentro deste seletor (ex.: o conteúdo, nunca uma folha). */
  dentroDe: string;
}

const LIMIAR = 64; // px de puxada (já com a resistência) para atualizar
const RESISTENCIA = 0.5; // a tela anda metade do dedo
const MINIMO_GIRANDO_MS = 450; // girar rápido demais parece falha

/**
 * Puxar para atualizar (fase Fluidez, 14/10): no topo da página, arrastar para baixo mostra
 * um círculo que acompanha o dedo e, passando do limiar, relê a tela ao soltar. O gesto
 * nativo do navegador (recarregar a página) fica desligado enquanto o painel está aberto.
 */
export function PuxarParaAtualizar({ ligado, aoAtualizar, dentroDe }: PuxarParaAtualizarProps) {
  const reduzido = useMovimentoReduzido();
  const [puxada, setPuxada] = useState(0);
  const [girando, setGirando] = useState(false);
  const atual = useRef({ aoAtualizar, girando });
  atual.current = { aoAtualizar, girando };

  useEffect(() => {
    if (!ligado) return;
    const raiz = document.documentElement;
    const antes = raiz.style.overscrollBehaviorY;
    raiz.style.overscrollBehaviorY = "contain";
    let gesto: { x0: number; y0: number; vertical: boolean | null } | null = null;
    let ultima = 0;

    const comeca = (e: TouchEvent) => {
      const alvo = e.target instanceof Element ? e.target : null;
      if (atual.current.girando || window.scrollY > 0 || e.touches.length !== 1 || !alvo?.closest(dentroDe)) { gesto = null; return; }
      gesto = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, vertical: null };
    };
    const move = (e: TouchEvent) => {
      if (!gesto) return;
      const dx = e.touches[0].clientX - gesto.x0;
      const dy = e.touches[0].clientY - gesto.y0;
      if (gesto.vertical === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        gesto.vertical = dy > 0 && Math.abs(dy) > Math.abs(dx);
        if (!gesto.vertical) { gesto = null; return; }
      }
      if (window.scrollY > 0) { gesto = null; ultima = 0; setPuxada(0); return; }
      ultima = Math.max(0, dy * RESISTENCIA);
      setPuxada(ultima);
    };
    const solta = () => {
      if (!gesto) return;
      gesto = null;
      const vai = ultima >= LIMIAR;
      ultima = 0;
      if (!vai) { setPuxada(0); return; }
      setGirando(true);
      setPuxada(LIMIAR);
      const inicio = Date.now();
      void atual.current.aoAtualizar().finally(() => {
        window.setTimeout(() => { setGirando(false); setPuxada(0); }, Math.max(0, MINIMO_GIRANDO_MS - (Date.now() - inicio)));
      });
    };

    window.addEventListener("touchstart", comeca, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", solta);
    window.addEventListener("touchcancel", solta);
    return () => {
      raiz.style.overscrollBehaviorY = antes;
      window.removeEventListener("touchstart", comeca);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", solta);
      window.removeEventListener("touchcancel", solta);
    };
  }, [ligado, dentroDe]);

  if (!ligado || (puxada === 0 && !girando)) return null;
  const progresso = Math.min(1, puxada / LIMIAR);
  return (
    <div
      className="cos-puxar"
      data-girando={girando || undefined}
      data-pronto={progresso >= 1 || undefined}
      style={{ transform: `translate(-50%, ${Math.min(puxada, LIMIAR * 1.4)}px)`, opacity: Math.max(0.25, progresso) }}
      role={girando ? "status" : undefined}
      aria-live="polite"
    >
      <RotateCw size={20} strokeWidth={2.2} aria-hidden="true" style={reduzido || girando ? undefined : { transform: `rotate(${progresso * 270}deg)` }} />
      {girando && <span className="cos-sr">Atualizando</span>}
    </div>
  );
}
