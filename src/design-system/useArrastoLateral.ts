import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { CURVA_CSS, DURACAO, useMovimentoReduzido } from "./movimento";
import "./arrasto.css";

/** 1 = próximo (o dedo vai para a esquerda); -1 = anterior. */
export type Lado = 1 | -1;

/** O combinado entre o gesto e a tela que chega: de que lado ela vem e como avisa que montou. */
export interface Chegada { lado: Lado; avisar: () => void }
export type RefDaChegada = MutableRefObject<Chegada | null>;

export interface OpcoesDoArrasto {
  /** "tela" (a casca troca de aba) ou "item" (o detalhe troca de item): nomeia a transição. */
  tipo: "tela" | "item";
  /** Onde o gesto deixa a chegada para a tela nova consumir (`chegar`). */
  chegada: RefDaChegada;
  /** Só no celular e quando há para onde ir; desligado, o elemento fica como está. */
  ligado: boolean;
  /** Existe tela/item desse lado? Sem vizinho, o arrasto resiste (efeito elástico) e volta. */
  podeIr: (lado: Lado) => boolean;
  /** Navega para o vizinho. A tela nova chama `chegar` ao montar. */
  aoIr: (lado: Lado) => void;
}

const DECIDIR_PX = 10; // até aqui o gesto ainda não disse se é rolagem ou arrasto
const TRAVA = 1.2; // horizontal só quando |dx| passa |dy| com folga (não rouba a rolagem)
const FRACAO_PARA_IR = 0.25; // arrastou um quarto da tela: vai
const VELOCIDADE_PARA_IR = 0.45; // px/ms: um peteleco curto também vai
const ELASTICO = 0.25; // sem vizinho, a tela anda um quarto do dedo
const ESPERA_MAX_MS = 1000; // a tela nova não montou até aqui: a troca anima com o que tiver

/** O toque começou num lugar que já usa o gesto lateral (campo, carrossel, controle)? */
function alvoTemDono(alvo: EventTarget | null, raiz: HTMLElement): boolean {
  for (let el = alvo instanceof Element ? alvo : null; el && el !== raiz; el = el.parentElement) {
    if (el.matches("input, textarea, select, [contenteditable], [role='slider'], [data-sem-arrasto]")) return true;
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 2) {
      const x = getComputedStyle(el).overflowX;
      if (x === "auto" || x === "scroll") return true;
    }
  }
  return false;
}

/**
 * Arrastar para o lado com o dedo (polimento mobile, leva 2, 14/10): a tela segue o dedo,
 * trava na direção (rolagem vertical continua do navegador) e assenta com o impulso do gesto.
 * Só toque (mouse e caneta não arrastam). Depois de um arrasto, o clique que viria é engolido.
 */
export function useArrastoLateral<T extends HTMLElement>(ref: RefObject<T>, { tipo, chegada, ligado, podeIr, aoIr }: OpcoesDoArrasto) {
  const reduzido = useMovimentoReduzido();
  const atual = useRef({ podeIr, aoIr, reduzido });
  atual.current = { podeIr, aoIr, reduzido };

  useEffect(() => {
    const el = ref.current;
    if (!el || !ligado) return;
    el.style.touchAction = "pan-y";
    el.dataset.arrastoLateral = tipo;
    let gesto: null | { id: number; x0: number; y0: number; modo: "indeciso" | "lateral"; dx: number; amostras: Array<[number, number]> } = null;
    let engolirClique = false;

    const pintar = (dx: number) => {
      el.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
      el.style.opacity = dx ? String(1 - Math.min(Math.abs(dx) / el.clientWidth, 1) * 0.35) : "";
    };

    const soltar = (dx: number, velocidade: number) => {
      const lado: Lado = dx < 0 ? 1 : -1;
      const largura = el.clientWidth;
      const vai = atual.current.podeIr(lado) && (Math.abs(dx) > largura * FRACAO_PARA_IR || (Math.abs(velocidade) > VELOCIDADE_PARA_IR && Math.sign(velocidade) === Math.sign(dx)));
      if (vai) {
        const montou = new Promise<void>((avisar) => { chegada.current = { lado, avisar }; });
        const raiz = document.documentElement;
        if (!atual.current.reduzido && typeof document.startViewTransition === "function") {
          // Como num app: a tela antiga sai PELO LADO enquanto a nova entra colada nela,
          // as duas partindo de onde o dedo soltou (arrasto.css). O navegador fotografa a
          // antiga, espera a nova montar e anima as duas juntas.
          raiz.style.setProperty("--cos-arrasto-x", `${dx}px`);
          raiz.style.setProperty("--cos-arrasto-lado", String(lado));
          raiz.dataset.cosArrasto = tipo;
          pintar(0);
          const troca = document.startViewTransition(() => {
            atual.current.aoIr(lado);
            return Promise.race([montou, new Promise<void>((r) => window.setTimeout(r, ESPERA_MAX_MS))]);
          });
          void troca.finished.finally(() => {
            delete raiz.dataset.cosArrasto;
            raiz.style.removeProperty("--cos-arrasto-x");
            raiz.style.removeProperty("--cos-arrasto-lado");
          });
          return;
        }
        // Sem View Transitions (ou movimento reduzido): a nova entra pelo lado (`entrarDoLado`).
        pintar(0);
        el.style.opacity = "0";
        atual.current.aoIr(lado);
        return;
      }
      const animar = !atual.current.reduzido && typeof el.animate === "function";
      if (!animar) { pintar(0); return; }
      el.animate(
        [{ transform: `translate3d(${dx}px,0,0)`, opacity: el.style.opacity || 1 }, { transform: "translate3d(0,0,0)", opacity: 1 }],
        { duration: DURACAO.medio, easing: CURVA_CSS },
      );
      pintar(0); // fica no lugar quando a volta terminar
    };

    const baixo = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || alvoTemDono(e.target, el)) { gesto = null; return; }
      gesto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, modo: "indeciso", dx: 0, amostras: [[e.timeStamp, e.clientX]] };
    };
    const mover = (e: PointerEvent) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const dx = e.clientX - gesto.x0;
      const dy = e.clientY - gesto.y0;
      if (gesto.modo === "indeciso") {
        if (Math.abs(dx) < DECIDIR_PX && Math.abs(dy) < DECIDIR_PX) return;
        if (Math.abs(dx) <= Math.abs(dy) * TRAVA) { gesto = null; return; }
        // Linha com ação para a direita (DeslizarParaAcao): esse sentido é dela.
        if (dx > 0 && e.target instanceof Element && e.target.closest("[data-arrasto-direita]")) { gesto = null; return; }
        gesto.modo = "lateral";
        el.setPointerCapture?.(e.pointerId);
      }
      e.stopPropagation(); // a folha (vaul) não arrasta junto
      const lado: Lado = dx < 0 ? 1 : -1;
      gesto.dx = atual.current.podeIr(lado) ? dx : dx * ELASTICO;
      gesto.amostras.push([e.timeStamp, e.clientX]);
      if (gesto.amostras.length > 5) gesto.amostras.shift();
      pintar(gesto.dx);
    };
    const cima = (e: PointerEvent) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const g = gesto;
      gesto = null;
      if (g.modo !== "lateral") return;
      engolirClique = true;
      window.setTimeout(() => { engolirClique = false; }, 0);
      const [t0, x0] = g.amostras[0];
      const [t1, x1] = g.amostras[g.amostras.length - 1];
      soltar(e.type === "pointercancel" ? 0 : g.dx, t1 > t0 ? (x1 - x0) / (t1 - t0) : 0);
    };
    const clique = (e: MouseEvent) => { if (engolirClique) { e.preventDefault(); e.stopPropagation(); } };

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
      el.style.touchAction = "";
      delete el.dataset.arrastoLateral;
      pintar(0);
    };
  }, [ref, ligado, tipo, chegada]);
}

/**
 * A tela que acabou de montar consome a chegada: avisa o gesto e, sem View Transitions,
 * entra pelo lado. Devolve a limpeza, ou `null` se não veio de um arrasto.
 */
export function chegar(el: HTMLElement, chegada: RefDaChegada, reduzido: boolean): (() => void) | null {
  const c = chegada.current;
  if (!c) return null;
  chegada.current = null;
  c.avisar();
  if (document.documentElement.dataset.cosArrasto) { el.style.transform = ""; el.style.opacity = ""; return () => {}; }
  return entrarDoLado(el, c.lado, reduzido);
}

/**
 * A tela nova entra pelo lado de onde o dedo a puxou (o próximo vem da direita).
 * Limpa o que o arrasto deixou no estilo; em movimento reduzido só aparece.
 */
export function entrarDoLado(el: HTMLElement, lado: Lado, reduzido: boolean) {
  el.style.transform = "";
  el.style.opacity = "";
  if (reduzido || typeof el.animate !== "function") return () => {};
  const a = el.animate(
    [{ transform: `translate3d(${lado * 36}%,0,0)`, opacity: 0 }, { transform: "translate3d(0,0,0)", opacity: 1 }],
    { duration: DURACAO.lento, easing: CURVA_CSS },
  );
  return () => a.cancel();
}
