import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { moneyBRL } from "@/lib/store-utils";
import { cn } from "@/lib/utils";
import { ladoDoBalao } from "./balao";
import "./dados.css";

export interface DeltaProps {
  atual: number;
  /** `null`/`undefined` = sem base de comparação: não aparece nada (nada inventado). */
  anterior: number | null | undefined;
  /** A base por extenso ("ontem até esta hora", "os 7 dias antes"…): leitor de tela, dica e balão. */
  rotulo: string;
  /** A base curta que aparece na tela ("ontem", "7 dias antes"). Sem ela, usa o `rotulo` (no compacto, "ontem"). */
  curto?: string;
  /** Dinheiro (R$) ou contagem (pedidos, vendas). */
  formato?: "dinheiro" | "inteiro";
  /** Subir é bom (faturamento) ou ruim (despesa). */
  sentido?: "maior-melhor" | "menor-melhor";
  /**
   * Enxuto (pedido do Rapha, 11/10): na tela a seta, a cor e "até ontem R$ X";
   * a variação e quanto a mais/menos abrem num balão ao passar o mouse, focar ou tocar.
   */
  compacto?: boolean;
  className?: string;
}

/** O balão do modo compacto: abre por hover (só com mouse), foco ou toque; fecha com Esc, ao sair, ao rolar e ao tocar fora. */
function DeltaCompacto({ tom, Icone, linha, variacao, explicacao, falado, className }: {
  tom: string; Icone: typeof Minus; linha: string; variacao: string; explicacao: string; falado: string; className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const espaco = linha.indexOf(" ");
  const primeira = espaco < 0 ? linha : linha.slice(0, espaco);
  const resto = espaco < 0 ? "" : linha.slice(espaco + 1);
  const raiz = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  // Perto da borda direita (coluna estreita em 320 px) o balão se ancora pela direita
  // e cresce para a esquerda: nunca cria rolagem lateral (regra da Flush, `balao.ts`).
  const [lado, setLado] = useState<"esquerda" | "direita">("esquerda");
  useLayoutEffect(() => {
    if (!aberto) return;
    const r = raiz.current?.getBoundingClientRect();
    const b = balao.current?.getBoundingClientRect();
    if (r && b) setLado(ladoDoBalao(r, b.width, document.documentElement.clientWidth));
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) fechar(); };
    window.addEventListener("scroll", fechar, { capture: true, passive: true });
    document.addEventListener("pointerdown", fora);
    return () => {
      window.removeEventListener("scroll", fechar, { capture: true });
      document.removeEventListener("pointerdown", fora);
    };
  }, [aberto]);
  return (
    <span ref={raiz} className={cn("cos-delta", "cos-delta-compacto", `cos-delta-${tom}`, className)} data-aberto={aberto || undefined} data-lado={lado}>
      <button
        type="button"
        className="cos-delta-alvo"
        aria-describedby={id}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        onBlur={() => setAberto(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setAberto(false); }}
      >
        {/* A seta vai colada à primeira palavra: ao quebrar, nunca fica sozinha na linha (revisão 2, R3). */}
        <span className="cos-delta-cola"><Icone size={14} strokeWidth={2.25} aria-hidden="true" />{primeira}</span>
        {resto && <> {resto}</>}
      </button>
      <span id={id} ref={balao} role="tooltip" className="cos-delta-balao">
        <span aria-hidden="true">
          <strong className="cos-delta-balao-num">{variacao}</strong>
          <span className="cos-delta-balao-texto">{explicacao}</span>
        </span>
        <span className="cos-sr">{falado}</span>
      </span>
    </span>
  );
}

/**
 * Variação contra uma base, curta ("↗ 12% vs ontem"; crítica de design, item 9,
 * enxugada em 10/10: "menos é mais"). Verde/vermelho só pelo sentido do
 * dinheiro. Sem base, ou os dois lados zerados, não aparece nada; base zero
 * mostra a diferença absoluta (nada de "∞ %"). O valor da base fica na dica
 * (`title`) e no leitor de tela, não na linha. No `compacto`, a linha é
 * "até ontem R$ X" e a variação vai para o balão.
 */
export function Delta({ atual, anterior, rotulo, curto, formato = "dinheiro", sentido = "maior-melhor", compacto = false, className }: DeltaProps) {
  if (anterior === null || anterior === undefined) return null;
  if (atual === 0 && anterior === 0) return null;
  const fmt = (n: number) => (formato === "dinheiro" ? moneyBRL(n) : String(n));
  const diff = Math.round((atual - anterior) * 100) / 100;
  const pct = anterior > 0 ? Math.round((diff / anterior) * 100) : null;
  // Verde/vermelho só em dinheiro (regra do Rapha): contagem (pedidos, vendas) fica neutra.
  const tom = diff === 0 || formato === "inteiro" ? "neutro" : (diff > 0) === (sentido === "maior-melhor") ? "positivo" : "negativo";

  if (compacto) {
    const Icone = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
    const sinal = diff > 0 ? "+" : diff < 0 ? "−" : "";
    const variacao = diff === 0 ? "Igual" : pct === null ? `${sinal}${fmt(Math.abs(diff))}` : `${sinal}${Math.abs(pct)}%`;
    const explicacao = diff === 0 ? `igual a ${rotulo}` : `${fmt(Math.abs(diff))} a ${diff > 0 ? "mais" : "menos"} que ${rotulo}`;
    const relacao = diff > 0 ? "acima de" : diff < 0 ? "abaixo de" : "igual a";
    const falado = `${diff === 0 ? "" : `${pct === null ? fmt(Math.abs(diff)) : `${Math.abs(pct)}%`} `}${relacao} ${rotulo} (${fmt(anterior)})`;
    return (
      <DeltaCompacto
        tom={tom}
        Icone={Icone}
        linha={`até ${curto ?? "ontem"} ${fmt(anterior)}`}
        variacao={variacao}
        explicacao={explicacao}
        falado={falado}
        className={className}
      />
    );
  }

  const base = curto ?? rotulo;
  const completo = `${rotulo}: ${fmt(anterior)}`;
  if (diff === 0) {
    return (
      <span className={cn("cos-delta", "cos-delta-neutro", className)} title={completo}>
        igual a {base}<span className="cos-sr"> ({fmt(anterior)})</span>
      </span>
    );
  }
  const Icone = diff > 0 ? ArrowUpRight : ArrowDownRight;
  const variacao = pct === null ? fmt(Math.abs(diff)) : `${Math.abs(pct)}%`;
  const relacao = diff > 0 ? "acima de" : "abaixo de";
  return (
    <span className={cn("cos-delta", `cos-delta-${tom}`, className)} title={completo}>
      <span className="cos-delta-cola" aria-hidden="true"><Icone size={14} strokeWidth={2.25} aria-hidden="true" />{variacao}</span>
      <span className="cos-delta-base" aria-hidden="true">vs {base}</span>
      <span className="cos-sr">{`${variacao} ${relacao} ${rotulo} (${fmt(anterior)})`}</span>
    </span>
  );
}
