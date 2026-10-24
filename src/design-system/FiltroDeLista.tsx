import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export interface OpcaoDeFiltro<T extends string> {
  valor: T;
  rotulo: string;
  /** Quantos itens há neste filtro; some quando é zero ou não informado. */
  conta?: number;
}

/**
 * Filtros de uma lista ao lado da busca (11/10, "algo mais clean"): texto
 * simples, o escolhido vira uma pílula verde-clara (a do Segmentado) e a contagem é
 * um número discreto. Sem trilho cinza. Grupo de rádio com setas, como o Segmentado.
 * Nome acessível = o texto que aparece (WCAG 2.5.3): sem aria-label nas opções; o espaço
 * antes da contagem faz o leitor ouvir "À venda 3", não "À venda3" (no flex ele não ocupa lugar).
 */
export function FiltroDeLista<T extends string>({ opcoes, valor, aoMudar, rotulo, className }: {
  opcoes: ReadonlyArray<OpcaoDeFiltro<NoInfer<T>>>;
  valor: T;
  aoMudar: (valor: NoInfer<T>) => void;
  rotulo: string;
  className?: string;
}) {
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);
  const ativo = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const i = (ativo + passo + opcoes.length) % opcoes.length;
    aoMudar(opcoes[i].valor);
    botoes.current[i]?.focus();
  };
  return (
    <div className={cn("cos-filtros", className)} data-vaul-no-drag role="radiogroup" aria-label={rotulo} onKeyDown={aoTeclar}>
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          ref={(b) => { botoes.current[i] = b; }}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          tabIndex={i === ativo ? 0 : -1}
          className="cos-filtro"
          onClick={() => aoMudar(o.valor)}
        >
          {o.rotulo}
          {o.conta ? <>{" "}<span className="cos-filtro-conta">{o.conta}</span></> : null}
        </button>
      ))}
    </div>
  );
}
