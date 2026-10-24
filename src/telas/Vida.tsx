import type { CSSProperties } from "react";
import { Camera, CreditCard, MapPin } from "lucide-react";
import { Anel } from "@/design-system/Anel";
import { Bloco, TituloBloco } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { Valor } from "@/design-system/Valor";
import { dinheiroMes, linhaDoTempo, metas } from "@/data/exemplo";

const ICONE = { "foto + local": MapPin, extrato: CreditCard, "foto sem local": Camera } as const;

export function Vida() {
  const sobrou = dinheiroMes.entradas - dinheiroMes.saidas;
  const maior = Math.max(dinheiroMes.entradas, dinheiroMes.saidas);
  return (
    <>
      <CabecalhoDeTela titulo="Vida" sub="Dinheiro pessoal, metas e a sua linha do tempo." />
      <div className="ini-grade">
        <div className="ini-lugar" style={{ "--ini-cl": 7, "--ini-cm": 2 } as CSSProperties}>
          <Bloco className="dr-mes" aria-label="Dinheiro do mês">
            <TituloBloco titulo="Dinheiro do mês" sub="Itaú, PicPay e InfinitePay · só leitura" />
            <div className="ini-semana-total"><Valor valor={sobrou} tamanho="g" centavos={false} tom="positivo" /></div>
            <p className="dr-mes-legenda">sobrou até hoje</p>
            <ul className="ini-pares dr-mes-barras">
              {([["Entrou", dinheiroMes.entradas, "positivo"], ["Saiu", dinheiroMes.saidas, "negativo"]] as const).map(([nome, v, tom]) => (
                <li key={nome} className="ini-par" style={{ "--i": 0 } as CSSProperties}>
                  <div className="ini-par-cab"><span>{nome}</span><b data-tom={tom}><Valor valor={v} tamanho="p" centavos={false} /></b></div>
                  <div className="ini-par-barras" aria-hidden="true">
                    <span className="ini-par-barra" data-hoje={tom === "positivo" || undefined} style={{ "--parte": v / maior } as CSSProperties}><i /></span>
                  </div>
                </li>
              ))}
            </ul>
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 5, "--ini-cm": 2 } as CSSProperties}>
          <Bloco className="ini-mod ini-meta" aria-label="Metas">
            <TituloBloco titulo="Metas" />
            <div className="dr-metas">
              {metas.map(([nome, pct]) => (
                <div key={nome} className="dr-meta">
                  <Anel fatias={[{ valor: pct / 100, tom: "acento" }]} total={1} tamanho={96} espessura={10}>
                    <strong className="ini-meta-pct">{pct}%</strong>
                  </Anel>
                  <span>{nome}</span>
                </div>
              ))}
            </div>
          </Bloco>
        </div>
      </div>
      <Bloco className="ini-tl" aria-label="Linha do tempo">
        <TituloBloco titulo="Linha do tempo" sub={`${linhaDoTempo.dia} · fato separado de hipótese`} />
        <ol className="ini-tl-lista">
          {linhaDoTempo.itens.map((e, i) => {
            const Icone = ICONE[e.base];
            return (
              <li key={e.hora} className="ini-tl-item" data-tipo={e.tipo === "fato" ? "venda" : "ajuste"} style={{ "--i": i } as CSSProperties}>
                <span className="ini-tl-link">
                  <time className="ini-tl-hora">{e.hora}</time>
                  <span className="ini-tl-marca" aria-hidden="true"><Icone size={14} strokeWidth={2} /></span>
                  <span className="ini-tl-texto"><small className="ini-tl-tipo">{e.tipo === "fato" ? "Fato" : "Hipótese"} · {e.base}</small><strong>{e.texto}</strong></span>
                </span>
              </li>
            );
          })}
        </ol>
      </Bloco>
    </>
  );
}
