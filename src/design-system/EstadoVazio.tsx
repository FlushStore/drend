import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";
import "./estados.css";

export interface EstadoVazioProps {
  titulo: string;
  texto?: ReactNode;
  /** Próximo passo (ex.: `<Botao>` ou `<Link className={classesDoBotao()}>`). */
  acao?: ReactNode;
  /** Nível do título (padrão h2). */
  nivel?: 2 | 3;
  className?: string;
}

/** Vazio que orienta: arte hachurada, o que significa e o que fazer. */
export function EstadoVazio({ titulo, texto, acao, nivel = 2, className }: EstadoVazioProps) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <div className={cn("cos-bloco cos-vazio", className)}>
      <div className="cos-vazio-arte" aria-hidden="true">
        <span /><span /><span />
      </div>
      <Titulo className="cos-estado-titulo">{titulo}</Titulo>
      {texto && <p className="cos-estado-texto">{texto}</p>}
      {acao}
    </div>
  );
}
