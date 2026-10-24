import type { CSSProperties } from "react";
import { Bloco, TituloBloco } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { ListaDeAtalhos } from "@/design-system/ListaDeAtalhos";
import { Valor } from "@/design-system/Valor";
import { drendStatus, flush, outrosProjetos, vapeMania } from "@/data/exemplo";
import { Estado, Linhas } from "./partes";
import { VendasDaSemana } from "./VendasDaSemana";

export function Negocios() {
  return (
    <>
      <CabecalhoDeTela titulo="Negócios" sub="A saúde de cada projeto. Para operar, abra o painel do próprio projeto." />
      <div className="ini-grade">
        <div className="ini-lugar" style={{ "--ini-cl": 5, "--ini-cm": 1 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="flushstore" aria-label="FlushStore">
            <TituloBloco titulo="FlushStore" sub="Loja de pods em Unaí" acao={<Estado tom="ok">Operando</Estado>} />
            <dl className="ini-dia-numeros dr-proj-num">
              <div className="ini-dia-principal"><dt>Faturamento hoje</dt><dd><Valor valor={flush.faturamento} tamanho="g" centavos={false} /></dd></div>
              <div><dt>Lucro</dt><dd><Valor valor={flush.lucro} tamanho="m" centavos={false} /></dd></div>
            </dl>
            <Linhas linhas={[...flush.saude, ["Próxima tarefa", flush.proximaTarefa]]} />
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 7, "--ini-cm": 1 } as CSSProperties}>
          <VendasDaSemana titulo="FlushStore na semana" dias={flush.semana} />
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 6, "--ini-cm": 1 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="vape-mania" aria-label="Vape Mania">
            <TituloBloco titulo="Vape Mania" sub="O DREND só olha a saúde do sistema" acao={<Estado tom="ok">No ar</Estado>} />
            <Linhas linhas={vapeMania.saude} />
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 6, "--ini-cm": 1 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="drend" aria-label="DREND">
            <TituloBloco titulo="DREND" sub="Este painel" acao={<Estado tom="acento">{drendStatus.fase}</Estado>} />
            <Linhas linhas={drendStatus.saude} />
          </Bloco>
        </div>
      </div>
      <Bloco aria-label="Outros projetos">
        <TituloBloco titulo="Outros projetos" />
        <Linhas linhas={outrosProjetos} />
      </Bloco>
      <ListaDeAtalhos
        rotulo="Painéis dos projetos"
        itens={[
          { para: "/negocios", titulo: "Painel da Flush", descricao: "Pedidos, produtos, caixa e financeiro" },
          { para: "/negocios", titulo: "Painel da Vape Mania", descricao: "Vitrine, estoque e deploys" },
        ]}
      />
    </>
  );
}
