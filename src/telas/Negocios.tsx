import { Bloco } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { Valor } from "@/design-system/Valor";
import { drendStatus, flush, outrosProjetos, vapeMania } from "@/data/exemplo";
import { CurvaDaSemana } from "./VendasDaSemana";

/** Um projeto por bloco: o número que importa e o estado. Operar é no painel do projeto. */
export function Negocios() {
  const semana = flush.semana.reduce((t, d) => t + d.valor, 0);
  return (
    <>
      <CabecalhoDeTela titulo="Negócios" />
      <div className="dr-negocios">
        <Bloco className="dr-proj dr-proj-flush" aria-label="FlushStore">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">FlushStore</h2>
            <span className="dr-estado"><i className="dr-ponto" data-tom="ok" aria-hidden="true" />Operando</span>
          </div>
          <dl className="dr-numeros">
            <div><dt>Hoje</dt><dd><Valor valor={flush.faturamento} tamanho="g" centavos={false} /></dd></div>
            <div><dt>Lucro</dt><dd><Valor valor={flush.lucro} tamanho="g" centavos={false} /></dd></div>
            <div><dt>Semana</dt><dd><Valor valor={semana} tamanho="g" centavos={false} /></dd></div>
          </dl>
          <CurvaDaSemana dias={flush.semana} />
        </Bloco>

        <Bloco className="dr-proj" aria-label="Vape Mania">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">Vape Mania</h2>
            <span className="dr-estado"><i className="dr-ponto" data-tom="ok" aria-hidden="true" />No ar</span>
          </div>
          <p className="dr-proj-linha">{vapeMania.saude[2][0]} · {vapeMania.saude[2][1]}</p>
        </Bloco>

        <Bloco className="dr-proj" aria-label="DREND">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">DREND</h2>
            <span className="dr-estado"><i className="dr-ponto" data-tom="acento" aria-hidden="true" />{drendStatus.fase}</span>
          </div>
          <p className="dr-proj-linha">{drendStatus.saude[1][1]}</p>
        </Bloco>
      </div>

      <section className="dr-pausados" aria-label="Outros projetos">
        <h2 className="dr-rotulo">Outros</h2>
        <ul className="dr-lista">
          {outrosProjetos.map(([nome, estado]) => (
            <li key={nome} className="dr-lista-item dr-lista-estatico"><span>{nome}</span><small>{estado}</small></li>
          ))}
        </ul>
      </section>
    </>
  );
}
