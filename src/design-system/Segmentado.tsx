import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MOLA_INDICADOR, transicao, useMovimentoReduzido } from "./movimento";
import { useBordaDeRolagem } from "./useBordaDeRolagem";
import "./base.css";
import "./primitivas.css";

export interface OpcaoSegmentado<T extends string> {
  valor: T;
  rotulo: ReactNode;
  /** Complemento à direita do rótulo (ex.: contagem). */
  extra?: ReactNode;
}

export interface SegmentadoProps<T extends string> {
  opcoes: ReadonlyArray<OpcaoSegmentado<NoInfer<T>>>;
  /** Opção selecionada (`null` = nenhuma). O tipo das opções é inferido daqui. */
  valor: T | null;
  aoMudar: (valor: NoInfer<T>) => void;
  /** Nome acessível do grupo. */
  rotulo: string;
  /** `heroi` = dentro do bloco herói (indicador no acento). */
  tom?: "neutro" | "heroi";
  /**
   * `radio` (padrão) para filtros e escolhas; `abas` só quando cada opção controla um painel
   * (passe `controla` com o id do painel).
   */
  papel?: "radio" | "abas";
  controla?: string;
  className?: string;
}

const PROXIMA: Record<string, 1 | -1 | "inicio" | "fim"> = {
  ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: "inicio", End: "fim",
};

/**
 * Controle segmentado com indicador compartilhado (motion `layoutId`): a seleção desliza.
 * Teclado: setas/Home/End movem o foco e a seleção juntos (tabindex itinerante: só a opção
 * ativa entra no Tab).
 */
export function Segmentado<T extends string>({
  opcoes, valor, aoMudar, rotulo, tom = "neutro", papel = "radio", controla, className,
}: SegmentadoProps<T>) {
  const grupo = useId();
  const reduzido = useMovimentoReduzido();
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);
  const trilho = useRef<HTMLDivElement>(null);
  useBordaDeRolagem(trilho);
  const indiceAtivo = opcoes.findIndex((o) => o.valor === valor);
  const focavel = indiceAtivo >= 0 ? indiceAtivo : 0;
  const radio = papel === "radio";

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = PROXIMA[e.key];
    if (passo === undefined || opcoes.length === 0) return;
    e.preventDefault();
    const atual = botoes.current.findIndex((b) => b === document.activeElement);
    const base = atual >= 0 ? atual : focavel;
    const total = opcoes.length;
    const destino =
      passo === "inicio" ? 0 : passo === "fim" ? total - 1 : (base + passo + total) % total;
    botoes.current[destino]?.focus();
    aoMudar(opcoes[destino].valor);
  };

  return (
    <div
      ref={trilho}
      className={cn("cos-seg", tom === "heroi" && "cos-seg-heroi", className)}
      // Pode rolar para o lado num celular estreito: dentro de uma folha (vaul), o gesto é da lista.
      data-vaul-no-drag
      role={radio ? "radiogroup" : "tablist"}
      aria-label={rotulo}
      onKeyDown={aoTeclar}
      data-movimento={reduzido ? "reduzido" : "pleno"}
    >
      {opcoes.map((o, i) => {
        const ativo = i === indiceAtivo;
        return (
          <button
            key={o.valor}
            ref={(el) => { botoes.current[i] = el; }}
            type="button"
            role={radio ? "radio" : "tab"}
            aria-checked={radio ? ativo : undefined}
            aria-selected={radio ? undefined : ativo}
            aria-controls={radio ? undefined : controla}
            tabIndex={i === focavel ? 0 : -1}
            className="cos-seg-op"
            onClick={() => aoMudar(o.valor)}
          >
            {ativo && (
              <motion.span
                layoutId={`cos-seg-${grupo}`}
                className="cos-seg-marca"
                transition={transicao(reduzido, MOLA_INDICADOR)}
              />
            )}
            <span>{o.rotulo}</span>
            {/* Rótulo visível = nome acessível (WCAG 2.5.3); o espaço separa o extra no leitor. */}
            {o.extra ? <>{" "}{o.extra}</> : null}
          </button>
        );
      })}
    </div>
  );
}
