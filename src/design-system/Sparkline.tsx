import { cn } from "@/lib/utils";
import "./dados.css";

const LARGURA = 72;
const ALTURA = 24;
const VAO = 3;

/**
 * Linha de tendência em miniatura: uma barra por dia, a última (hoje) em
 * acento, as outras apagadas (crítica de design, item 9). O `rotulo` diz os
 * valores para quem não vê (o detalhe por dia vive no Financeiro).
 */
export function Sparkline({ valores, rotulo, className }: { valores: readonly number[]; rotulo: string; className?: string }) {
  // Sem nenhuma venda nos dias, não há tendência para mostrar (a linha tracejada só poluía).
  if (valores.length < 2 || valores.every((v) => v === 0)) return null;
  const maior = Math.max(1, ...valores);
  const largura = (LARGURA - VAO * (valores.length - 1)) / valores.length;
  return (
    <svg className={cn("cos-sparkline", className)} viewBox={`0 0 ${LARGURA} ${ALTURA}`} width={LARGURA} height={ALTURA} role="img" aria-label={rotulo}>
      {valores.map((v, i) => {
        const altura = Math.max(v > 0 ? 2 : 1, (v / maior) * ALTURA);
        return (
          <rect
            key={i}
            x={i * (largura + VAO)}
            y={ALTURA - altura}
            width={largura}
            height={altura}
            rx={1.5}
            className={i === valores.length - 1 ? "cos-sparkline-hoje" : undefined}
          />
        );
      })}
    </svg>
  );
}
