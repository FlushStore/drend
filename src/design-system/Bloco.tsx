import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

type ElementoDeBloco = "section" | "div" | "article" | "li" | "aside";

export interface BlocoProps extends HTMLAttributes<HTMLElement> {
  /** Elemento HTML (padrão `section`). */
  como?: ElementoDeBloco;
  /** Hachura diagonal: "ainda não aconteceu / previsto / vazio". */
  hachura?: boolean;
}

/** Superfície básica: raio 24, linha e sombra quase imperceptíveis. */
export function Bloco({ como: Elemento = "section", hachura = false, className, ...resto }: BlocoProps) {
  return <Elemento className={cn("cos-bloco", hachura && "cos-hachura", className)} {...resto} />;
}

/**
 * O bloco que mais contrasta (grafite no claro, papel no escuro). **Um por tela**: é a resposta
 * para "o que faço agora?".
 */
export function BlocoHeroi({ className, ...resto }: BlocoProps) {
  return <Bloco className={cn("cos-heroi", className)} {...resto} />;
}

export interface TituloBlocoProps {
  titulo: string;
  sub?: ReactNode;
  /** Ação à direita (ex.: `SetaCirculo`, link "ver tudo"). */
  acao?: ReactNode;
  /** Nível do título (padrão h2). */
  nivel?: 2 | 3;
}

export function TituloBloco({ titulo, sub, acao, nivel = 2 }: TituloBlocoProps) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <div className="cos-tb">
      <div>
        <Titulo className="cos-tb-titulo">{titulo}</Titulo>
        {sub && <p className="cos-tb-sub">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}
