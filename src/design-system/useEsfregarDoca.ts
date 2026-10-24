import { useEffect, useRef, type RefObject } from "react";

/**
 * Arrastar o dedo sobre a doca troca de aba (pedido do Rapha, 15/10), como a barra de
 * abas dos apps. O toque simples continua sendo um clique comum.
 *
 * Fluidez (revisão de 15/10, "ainda dá umas travadas"): durante o gesto NADA passa pelo
 * React. Um cursor (`[data-doca-cursor]`) segue o dedo por `transform` a cada quadro e a
 * aba sob o dedo ganha `data-sob` direto no DOM; a tela só troca ao soltar (ou com o dedo
 * parado sobre a aba por `ASSENTAR_MS`), porque montar uma tela no meio do arrasto é o
 * que travava. Ao soltar, o cursor assenta na aba escolhida e some.
 *
 * - Só começa com o dedo andando mais para o lado que para cima (não rouba a rolagem).
 * - Quem tem `data-doca-fora` (o +) não começa o gesto; passando por cima dele, a aba
 *   marcada continua a anterior.
 * - Depois de um arrasto, o clique que viria ao soltar é engolido.
 */
export interface OpcoesDoEsfregar {
  ligado: boolean;
  /**
   * Abre a aba. `lado`: 1 = veio da esquerda para a direita (próxima), -1 = anterior.
   * `primeira`: a primeira troca deste gesto (as outras podem substituir no histórico).
   */
  aoEscolher: (id: string, lado: 1 | -1, primeira: boolean) => void;
}

const DECIDIR_PX = 6;
/** Dedo parado sobre a aba por este tempo: troca a tela sem esperar soltar. */
export const ASSENTAR_MS = 450;
/** O cursor desliza até a aba escolhida antes de sumir. */
export const POUSO_MS = 160;

interface Aba { id: string; el: HTMLElement; esquerda: number; direita: number }

/** Aba sob o dedo pelo eixo x; no vão entre elas (ou sobre o +), `null`. */
export function abaSobX(abas: ReadonlyArray<{ id: string; esquerda: number; direita: number }>, x: number): string | null {
  return abas.find((a) => x >= a.esquerda && x < a.direita)?.id ?? null;
}

export function useEsfregarDoca(ref: RefObject<HTMLElement>, ativo: string | null, { ligado, aoEscolher }: OpcoesDoEsfregar) {
  const atual = useRef({ ativo, aoEscolher });
  atual.current = { ativo, aoEscolher };

  useEffect(() => {
    const el = ref.current;
    if (!el || !ligado) return;
    el.style.touchAction = "pan-y";
    type Gesto = {
      id: number; x0: number; y0: number; x: number; ligado: boolean; base: number; largura: number;
      abas: Aba[]; realce: string | null; aberta: string | null; trocas: number; relogio: number; quadro: number;
    };
    let gesto: Gesto | null = null;
    let engolirClique = false;
    let pouso = 0;
    const cursor = () => el.querySelector<HTMLElement>("[data-doca-cursor]");

    const ordem = (g: Gesto, id: string | null) => g.abas.findIndex((a) => a.id === id);
    const abrir = (g: Gesto) => {
      window.clearTimeout(g.relogio);
      const destino = g.realce;
      if (!destino || destino === g.aberta) return;
      const lado = ordem(g, destino) > ordem(g, g.aberta) ? 1 : -1;
      g.aberta = destino;
      atual.current.aoEscolher(destino, lado, g.trocas === 0);
      g.trocas += 1;
    };
    const marcar = (g: Gesto, id: string | null) => {
      for (const a of g.abas) {
        if (a.id === id) a.el.dataset.sob = "";
        else delete a.el.dataset.sob;
      }
    };
    /** Centro do cursor no dedo, preso entre a primeira e a última aba. */
    const posicionar = (g: Gesto, centro: number) => {
      const c = cursor();
      if (!c || g.abas.length === 0) return;
      const min = g.abas[0].esquerda - g.base;
      const max = g.abas[g.abas.length - 1].direita - g.base - g.largura;
      const x = Math.min(max, Math.max(min, centro - g.base - g.largura / 2));
      c.style.transform = `translate3d(${x}px,0,0)`;
    };

    const baixo = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target instanceof Element && e.target.closest("[data-doca-fora]")) { gesto = null; return; }
      const abas: Aba[] = [...el.querySelectorAll<HTMLElement>("[data-doca-aba]")].map((a) => {
        const r = a.getBoundingClientRect();
        return { id: a.dataset.docaAba ?? "", el: a, esquerda: r.left, direita: r.right };
      });
      const largura = abas.length ? Math.max(...abas.map((a) => a.direita - a.esquerda)) : 0;
      gesto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, ligado: false, base: el.getBoundingClientRect().left, largura, abas,
        realce: atual.current.ativo, aberta: atual.current.ativo, trocas: 0, relogio: 0, quadro: 0 };
    };
    const quadro = (g: Gesto | null = gesto) => {
      if (!g) return;
      g.quadro = 0;
      posicionar(g, g.x);
      const sob = abaSobX(g.abas, g.x);
      if (sob && sob !== g.realce) {
        g.realce = sob;
        marcar(g, sob);
        navigator.vibrate?.(5);
      }
    };
    const mover = (e: PointerEvent) => {
      const g = gesto;
      if (!g || e.pointerId !== g.id) return;
      g.x = e.clientX;
      if (!g.ligado) {
        const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (Math.abs(dx) < DECIDIR_PX && Math.abs(dy) < DECIDIR_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) { gesto = null; return; }
        g.ligado = true;
        try { el.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto: segue sem captura */ }
        window.clearTimeout(pouso);
        const c = cursor();
        if (c) { c.style.width = `${g.largura}px`; delete c.dataset.pousando; }
        el.dataset.esfregando = "";
        marcar(g, g.realce);
      }
      if (!g.quadro) g.quadro = requestAnimationFrame(() => quadro(g));
      // A tela só troca com o dedo PARADO sobre a aba: andando, nada além do cursor se mexe.
      window.clearTimeout(g.relogio);
      g.relogio = window.setTimeout(() => { quadro(g); if (gesto === g && g.realce !== g.aberta) abrir(g); }, ASSENTAR_MS);
    };
    const cima = (e: PointerEvent) => {
      const g = gesto;
      if (!g || e.pointerId !== g.id) return;
      gesto = null;
      window.clearTimeout(g.relogio);
      if (g.quadro) cancelAnimationFrame(g.quadro);
      if (!g.ligado) return;
      quadro(g); // o último movimento pode não ter pintado ainda
      engolirClique = true;
      window.setTimeout(() => { engolirClique = false; }, 0);
      const destino = g.abas.find((a) => a.id === g.realce);
      const c = cursor();
      // Assenta: o cursor desliza até o centro da aba escolhida e só então some.
      if (c && destino) { c.dataset.pousando = ""; posicionar(g, (destino.esquerda + destino.direita) / 2); }
      abrir(g);
      pouso = window.setTimeout(() => {
        marcar(g, null);
        delete el.dataset.esfregando;
        if (c) delete c.dataset.pousando;
      }, POUSO_MS);
    };
    const clique = (e: MouseEvent) => { if (engolirClique) { e.preventDefault(); e.stopPropagation(); } };

    el.addEventListener("pointerdown", baixo, { passive: true });
    el.addEventListener("pointermove", mover, { passive: true });
    el.addEventListener("pointerup", cima);
    el.addEventListener("pointercancel", cima);
    el.addEventListener("click", clique, true);
    return () => {
      if (gesto) { window.clearTimeout(gesto.relogio); if (gesto.quadro) cancelAnimationFrame(gesto.quadro); }
      window.clearTimeout(pouso);
      el.removeEventListener("pointerdown", baixo);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", cima);
      el.removeEventListener("pointercancel", cima);
      el.removeEventListener("click", clique, true);
      el.style.touchAction = "";
      delete el.dataset.esfregando;
    };
  }, [ref, ligado]);
}
