import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./estados.css";

export interface EsqueletoProps {
  /** O que está carregando (anunciado ao leitor de tela). */
  rotulo: string;
  /** Ossos e blocos com as MESMAS alturas da tela pronta (sem pulo de layout). */
  children: ReactNode;
  className?: string;
}

export function Esqueleto({ rotulo, children, className }: EsqueletoProps) {
  return (
    <div className={cn("cos-esqueleto", className)} role="status" aria-label={rotulo} aria-busy="true">
      {children}
    </div>
  );
}

export interface OssoProps {
  /** Altura em px (padrão 16). */
  altura?: number;
  /** Largura em px ou CSS ("60%"). Padrão: 100%. */
  largura?: number | string;
  /** Raio próprio (ex.: 999 para círculo). */
  raio?: number;
  className?: string;
}

/** Peça do esqueleto, com brilho que passa (desligado em movimento reduzido). */
export function Osso({ altura, largura, raio, className }: OssoProps) {
  const estilo: CSSProperties = { height: altura, width: largura, borderRadius: raio };
  return <span className={cn("cos-osso", className)} style={estilo} aria-hidden="true" />;
}
