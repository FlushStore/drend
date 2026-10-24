import { useId } from "react";
import { Bloco, TituloBloco } from "@/design-system/Bloco";
import { Valor } from "@/design-system/Valor";
import { curvaSuave } from "@/design-system/curva";
import { moneyBRL } from "@/lib/store-utils";

const L = 320;
const A = 120;
const M = 10;
const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

/** A curva da semana do Início da Flush: área suave, só o ponto de hoje, dias embaixo. */
export function CurvaDaSemana({ dias, ultimoEhHoje = true }: { dias: ReadonlyArray<{ dia: string; valor: number }>; ultimoEhHoje?: boolean }) {
  const grad = useId();
  const maior = Math.max(1, ...dias.map((d) => d.valor));
  const passo = dias.length > 1 ? (L - 2 * M) / (dias.length - 1) : 0;
  const pts = dias.map((d, i) => [M + i * passo, A - M - (d.valor / maior) * (A - 2 * M)] as [number, number]);
  const linha = curvaSuave(pts);
  const area = linha ? `${linha} L${pts[pts.length - 1][0]},${A} L${pts[0][0]},${A} Z` : "";
  const falado = dias.map((d) => `${DIA_LONGO[diaDaSemana(d.dia)]}: ${moneyBRL(d.valor)}`).join("; ");
  return (
    <>
      <figure className="ini-semana-grafico" role="img" aria-label={`Faturamento por dia. ${falado}.`}>
        <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="ini-semana-grad-topo" />
              <stop offset="100%" className="ini-semana-grad-base" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${grad})`} />}
          {linha && <path d={linha} className="ini-semana-linha" vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.length > 0 && (
          <span className="ini-semana-ponto" data-hoje="" aria-hidden="true"
            style={{ left: `${(pts[pts.length - 1][0] / L) * 100}%`, top: `${(pts[pts.length - 1][1] / A) * 100}%` }} />
        )}
      </figure>
      <ol className="ini-semana-dias" aria-hidden="true">
        {dias.map((d, i) => <li key={d.dia} data-hoje={i === dias.length - 1 || undefined}>{i === dias.length - 1 && ultimoEhHoje ? "Hoje" : DIA_CURTO[diaDaSemana(d.dia)]}</li>)}
      </ol>
    </>
  );
}

/** O "Vendas da semana" do Início da Flush: total, curva e o melhor dia. */
export function VendasDaSemana({ titulo, dias }: { titulo: string; dias: ReadonlyArray<{ dia: string; valor: number }> }) {
  const total = dias.reduce((t, d) => t + d.valor, 0);
  const melhor = dias.reduce<{ dia: string; valor: number } | null>((m, d) => (d.valor > 0 && (!m || d.valor > m.valor) ? d : m), null);
  return (
    <Bloco className="ini-semana" aria-label={titulo}>
      <TituloBloco titulo={titulo} />
      <div className="ini-semana-total"><Valor valor={total} tamanho="g" centavos={false} /></div>
      <CurvaDaSemana dias={dias} />
      {melhor && <p className="ini-semana-melhor">Melhor dia: <strong>{DIA_LONGO[diaDaSemana(melhor.dia)]}</strong>, {moneyBRL(melhor.valor).replace(/,00$/, "")}</p>}
    </Bloco>
  );
}
