import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export type TomCirculo = "neutro" | "acento" | "heroi";

export interface BotaoCirculoProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Nome acessível obrigatório: o círculo só mostra um ícone. */
  rotulo: string;
  tom?: TomCirculo;
  /** O ícone (lucide 1.75, ~18 px). */
  children: ReactNode;
}

/** Botão de ícone em círculo de 44 px (alvo de toque mínimo). */
export const BotaoCirculo = forwardRef<HTMLButtonElement, BotaoCirculoProps>(function BotaoCirculo(
  { rotulo, tom = "neutro", className, type = "button", children, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={rotulo}
      className={cn("cos-circulo", tom !== "neutro" && `cos-circulo-${tom}`, className)}
      {...resto}
    >
      <span className="cos-icone" aria-hidden="true">{children}</span>
    </button>
  );
});

/**
 * Seta no círculo = "toque para abrir". Decorativa: o alvo é o bloco/link inteiro que a contém
 * (gira 45° no hover do pai).
 */
export function SetaCirculo({ tom = "neutro", className }: { tom?: TomCirculo; className?: string }) {
  return (
    <span className={cn("cos-seta", tom !== "neutro" && `cos-seta-${tom}`, className)} aria-hidden="true">
      <ArrowUpRight size={18} strokeWidth={1.75} />
    </span>
  );
}
