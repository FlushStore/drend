import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { classesDoBotao, type VarianteBotao } from "./classes";
import "./base.css";
import "./primitivas.css";

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  /** Ocupa a largura toda (ex.: rodapé de painel). */
  largo?: boolean;
  /** Ação em andamento: desabilita, anuncia `aria-busy` e troca o ícone por um giro. */
  ocupado?: boolean;
  /** Ação secundária dentro de um cartão ou linha: 36 px, letra 13. */
  compacto?: boolean;
  /** Ícone à esquerda do rótulo (decorativo). */
  icone?: ReactNode;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = "primaria", largo = false, compacto = false, ocupado = false, icone, className, disabled, type = "button", children, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classesDoBotao(variante, largo, cn(compacto && "cos-botao-compacto", className))}
      disabled={disabled || ocupado}
      aria-busy={ocupado || undefined}
      {...resto}
    >
      {ocupado ? (
        <Loader2 size={18} strokeWidth={2} className="cos-gira" aria-hidden="true" />
      ) : (
        icone && <span className="cos-icone" aria-hidden="true">{icone}</span>
      )}
      {children}
    </button>
  );
});
