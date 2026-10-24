import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./anel.css";

export interface FatiaDoAnel { valor: number; tom: "acento" | "tinta" | "suave" | "positivo" }

/**
 * Anel (16/10): progresso (uma fatia) ou rosca (várias). SVG puro, sem biblioteca de gráfico.
 * As fatias crescem do zero ao entrar (com movimento reduzido, já aparecem prontas). Decorativo
 * para o leitor de tela: quem usa põe o número e o texto ao lado ou dentro (`children`).
 */
export function Anel({ fatias, total: totalFixo, tamanho = 112, espessura = 12, className, children }: {
  fatias: readonly FatiaDoAnel[];
  /** Progresso: a volta inteira vale isto (ex.: 1). Sem ele, as fatias dividem a volta (rosca). */
  total?: number;
  tamanho?: number;
  espessura?: number;
  className?: string;
  children?: ReactNode;
}) {
  const raio = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * raio;
  const total = totalFixo ?? Math.max(1e-9, fatias.reduce((t, f) => t + Math.max(0, f.valor), 0));
  let inicio = 0;
  return (
    <div className={cn("cos-anel", className)} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true">
        <circle className="cos-anel-trilho" cx={tamanho / 2} cy={tamanho / 2} r={raio} strokeWidth={espessura} />
        {fatias.map((f, i) => {
          const parte = Math.max(0, f.valor) / total;
          const comprimento = parte * volta;
          const desloc = -inicio * volta;
          inicio += parte;
          return (
            <circle key={i} className="cos-anel-fatia" data-tom={f.tom} cx={tamanho / 2} cy={tamanho / 2} r={raio} strokeWidth={espessura}
              strokeDasharray={`${comprimento} ${volta}`} strokeDashoffset={desloc}
              style={{ "--volta": `${volta}`, "--atraso": `${i * 90}ms` } as CSSProperties} />
          );
        })}
      </svg>
      {children && <div className="cos-anel-meio">{children}</div>}
    </div>
  );
}
