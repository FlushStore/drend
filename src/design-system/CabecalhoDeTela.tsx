import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export interface CabecalhoDeTelaProps {
  titulo: string;
  /** Uma linha de resumo (contagens, o que a tela mostra). */
  sub?: ReactNode;
  /** O ⋯ (`OpcoesDaTela`) ou a ação da tela, à direita. */
  children?: ReactNode;
  className?: string;
  /**
   * Subtela (lançar, fechar, contar, conferir, relatório de uma seção): o ÚNICO jeito
   * de voltar, um círculo à esquerda do título, como a chegada e as compras com lotes
   * já faziam (revisão de 16/10, item 17). `rotulo` = "Voltar para <tela-mãe>".
   * Tela que é aba de seção não usa: as sub-abas já dizem onde se está.
   */
  voltar?: { para: string; rotulo: string };
}

/**
 * O cabeçalho de toda tela do Control OS (crítica de design, 09/10, item 10):
 * título grande, uma linha de resumo e o ⋯ à direita, um componente só em vez
 * de uma cópia por módulo. O `<h1>` é o nome da tela para o leitor de tela.
 */
export function CabecalhoDeTela({ titulo, sub, children, className, voltar }: CabecalhoDeTelaProps) {
  return (
    <div className={cn("cos-cab", voltar && "cos-cab-com-voltar", className)}>
      {voltar && (
        <Link to={voltar.para} className="cos-circulo cos-cab-voltar" aria-label={voltar.rotulo}>
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
      <div className="cos-cab-texto">
        <h1 className="cos-cab-titulo">{titulo}</h1>
        {sub !== undefined && sub !== null && sub !== "" && <p className="cos-cab-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
