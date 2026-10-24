import { useEffect, useRef, type ReactNode } from "react";
import { CURVA_CSS, DURACAO, useMovimentoReduzido } from "./movimento";
import { vibrarConfirmacao } from "./toque";
import "./deslizar.css";

export interface DeslizarParaAcaoProps {
  /** Só no celular; desligado, a linha fica como está. */
  ligado: boolean;
  /** O que aparece atrás da linha ao arrastar ("Atender", "Repor"). */
  rotulo: string;
  aoAcionar: () => void;
  children: ReactNode;
}

const DECIDIR_PX = 10;
const FRACAO = 0.35; // arrastou um terço da linha: aciona

/**
 * Ação com o dedo na linha da lista (fase Produtividade, 14/10): arrastar a linha PARA A
 * DIREITA mostra a ação atrás dela e, passando de um terço, aciona ao soltar. Para a esquerda
 * não faz nada aqui: o gesto segue para a troca de aba (useArrastoLateral), que respeita
 * `data-arrasto-direita`. Só toque; o clique que viria depois do arrasto é engolido.
 */
export function DeslizarParaAcao({ ligado, rotulo, aoAcionar, children }: DeslizarParaAcaoProps) {
  const linha = useRef<HTMLDivElement>(null);
  const fundo = useRef<HTMLDivElement>(null);
  const reduzido = useMovimentoReduzido();
  const atual = useRef({ aoAcionar, reduzido });
  atual.current = { aoAcionar, reduzido };

  useEffect(() => {
    const el = linha.current;
    if (!el || !ligado) return;
    let g: null | { id: number; x0: number; y0: number; lateral: boolean | null; dx: number } = null;
    let engolir = false;
    const pintar = (dx: number) => {
      el.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
      const pronto = dx >= el.clientWidth * FRACAO;
      if (fundo.current) { if (pronto) fundo.current.dataset.pronto = ""; else delete fundo.current.dataset.pronto; }
    };
    const baixo = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary) { g = null; return; }
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lateral: null, dx: 0 };
    };
    const mover = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (g.lateral === null) {
        if (Math.abs(dx) < DECIDIR_PX && Math.abs(dy) < DECIDIR_PX) return;
        g.lateral = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2;
        if (!g.lateral) { g = null; return; }
        el.setPointerCapture?.(e.pointerId);
      }
      e.stopPropagation();
      g.dx = Math.max(0, dx);
      pintar(g.dx);
    };
    const cima = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      const { lateral, dx } = g;
      g = null;
      if (!lateral) return;
      engolir = true;
      window.setTimeout(() => { engolir = false; }, 0);
      const vai = e.type !== "pointercancel" && dx >= el.clientWidth * FRACAO;
      if (vai) { vibrarConfirmacao(); atual.current.aoAcionar(); }
      if (!atual.current.reduzido && typeof el.animate === "function") {
        el.animate([{ transform: `translate3d(${dx}px,0,0)` }, { transform: "translate3d(0,0,0)" }], { duration: DURACAO.medio, easing: CURVA_CSS });
      }
      pintar(0);
    };
    const clique = (e: MouseEvent) => { if (engolir) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("pointerdown", baixo, { passive: true });
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", cima);
    el.addEventListener("pointercancel", cima);
    el.addEventListener("click", clique, true);
    return () => {
      el.removeEventListener("pointerdown", baixo);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", cima);
      el.removeEventListener("pointercancel", cima);
      el.removeEventListener("click", clique, true);
      pintar(0);
    };
  }, [ligado]);

  if (!ligado) return <>{children}</>;
  return (
    <div className="cos-deslizar" data-arrasto-direita="">
      <div ref={fundo} className="cos-deslizar-fundo" aria-hidden="true">{rotulo}</div>
      <div ref={linha} className="cos-deslizar-linha" style={{ touchAction: "pan-y" }}>{children}</div>
    </div>
  );
}
