import type { CSSProperties } from "react";
import { Anel } from "@/design-system/Anel";
import { Bloco } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { Valor } from "@/design-system/Valor";
import { dinheiroMes, linhaDoTempo, metas } from "@/data/exemplo";
import { AgendaDaSemana } from "./AgendaDaSemana";

export function Vida() {
  const sobrou = dinheiroMes.entradas - dinheiroMes.saidas;
  const gasto = dinheiroMes.saidas / dinheiroMes.entradas;
  return (
    <>
      <CabecalhoDeTela titulo="Vida" />
      <AgendaDaSemana />
      <div className="dr-hoje">
        <Bloco className="dr-heroi" aria-label="Dinheiro do mês">
          <span className="dr-rotulo">Sobrou no mês</span>
          <span className="dr-heroi-num"><Valor valor={sobrou} tamanho="gg" centavos={false} /></span>
          <div className="dr-barra" style={{ "--parte": gasto } as CSSProperties} aria-hidden="true"><i /></div>
          <dl className="dr-numeros dr-numeros-p">
            <div><dt>Entrou</dt><dd><Valor valor={dinheiroMes.entradas} tamanho="m" centavos={false} /></dd></div>
            <div><dt>Saiu</dt><dd><Valor valor={dinheiroMes.saidas} tamanho="m" centavos={false} /></dd></div>
          </dl>
        </Bloco>

        <Bloco className="dr-metas-bloco" aria-label="Metas">
          <span className="dr-rotulo">Metas</span>
          <div className="dr-metas">
            {metas.map(([nome, pct]) => (
              <div key={nome} className="dr-meta">
                <Anel fatias={[{ valor: pct / 100, tom: "acento" }]} total={1} tamanho={104} espessura={8}>
                  <strong className="dr-meta-pct">{pct}%</strong>
                </Anel>
                <span>{nome}</span>
              </div>
            ))}
          </div>
        </Bloco>
      </div>

      <section className="dr-dia" aria-label={`Linha do tempo, ${linhaDoTempo.dia}`}>
        <h2 className="dr-rotulo">{linhaDoTempo.dia}</h2>
        <ol className="dr-dia-lista">
          {linhaDoTempo.itens.map((e) => (
            <li key={e.hora} data-hipotese={e.tipo !== "fato" || undefined}>
              <time>{e.hora}</time>
              <span>{e.texto}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
