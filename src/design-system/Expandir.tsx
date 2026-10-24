import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./expandir.css";

/** Um pouco mais que a transição do CSS: se o `transitionend` não vier (movimento reduzido), desmonta assim mesmo. */
const FOLGA_DE_SAIDA_MS = 300;

/**
 * Bloco que abre e fecha crescendo, sem corte seco (pedido do Rapha, 16/10). Altura pela linha
 * da grade (0fr → 1fr) e fade; ao fechar, mantém o último conteúdo até a animação acabar.
 *
 * Fluidez (revisão de 16/10, "ainda está travando"): o React renderiza UMA vez por abrir ou
 * fechar. O começo da transição e o "assentou" são atributos postos direto no elemento (sem
 * novo render): antes eram três estados e dois quadros de espera, e cada um re-renderizava a
 * folha da venda inteira no meio da animação.
 */
export function Expandir({ aberto, children, className }: { aberto: boolean; children: ReactNode; className?: string }) {
  const [montado, setMontado] = useState(aberto);
  const el = useRef<HTMLDivElement>(null);
  const ultimo = useRef(children);
  const primeira = useRef(true);
  if (aberto) ultimo.current = children;
  if (aberto && !montado) setMontado(true);

  useLayoutEffect(() => {
    const no = el.current;
    const inicio = primeira.current;
    primeira.current = false;
    if (!no) return;
    if (aberto) {
      if (inicio) { no.dataset.aberto = ""; no.dataset.assentado = ""; return; }
      delete no.dataset.assentado;
      void no.offsetHeight; // o navegador registra o fechado antes de animar
      no.dataset.aberto = "";
      const pronto = window.setTimeout(() => { no.dataset.assentado = ""; }, FOLGA_DE_SAIDA_MS);
      return () => window.clearTimeout(pronto);
    }
    delete no.dataset.assentado;
    delete no.dataset.aberto;
    const fim = window.setTimeout(() => setMontado(false), FOLGA_DE_SAIDA_MS);
    return () => window.clearTimeout(fim);
  }, [aberto, montado]);

  if (!montado) return null;
  return (
    <div ref={el} className={cn("cos-expandir", className)} aria-hidden={aberto ? undefined : true}>
      <div className="cos-expandir-dentro">{aberto ? children : ultimo.current}</div>
    </div>
  );
}
