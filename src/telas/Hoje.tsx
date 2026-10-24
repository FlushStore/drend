import { Link } from "react-router-dom";
import { SetaCirculo } from "@/design-system/BotaoCirculo";
import { Valor } from "@/design-system/Valor";
import { agenda, drendStatus, flush } from "@/data/exemplo";
import { useFlush } from "@/fontes/useFlush";
import { useStore } from "@/store";
import { CurvaDaSemana } from "./VendasDaSemana";

function saudacao(agora: Date) {
  const h = agora.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Hoje: uma frase, um número e o que espera você. O resto mora nas outras abas.
 * Regra do painel da Flush: um herói por tela, nada de texto explicando a tela.
 */
export function Hoje() {
  const { caixaDeEntrada } = useStore();
  const numeros = useFlush();
  const agora = new Date();
  const longa = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const data = longa.charAt(0).toUpperCase() + longa.slice(1);
  const pendencias = [
    ...caixaDeEntrada.map((ideia, i) => ({ id: `ideia-${i}`, titulo: ideia, para: "/drend" })),
    { id: "control-os", titulo: flush.proximaTarefa, para: "/negocios" },
    { id: "fornecedor", titulo: "Responder o fornecedor", para: "/drend" },
    { id: "picpay", titulo: "Conectar o PicPay", para: "/vida" },
  ].slice(0, 4);
  const [hora, compromisso] = agenda[0];

  return (
    <>
      <header className="dr-ola">
        <p className="dr-ola-data">{data}</p>
        <h1 className="dr-ola-titulo">{saudacao(agora)}, <em>Rapha</em>.</h1>
      </header>

      <div className="dr-hoje">
        <Link to="/negocios" className="cos-bloco dr-heroi" aria-label={`FlushStore ${numeros.dia}: faturamento e lucro`}>
          <span className="dr-rotulo">
            FlushStore · {numeros.dia}
            {numeros.exemplo && <span className="dr-tag-exemplo">exemplo</span>}
          </span>
          <span className="dr-heroi-num">
            <Valor valor={numeros.hoje} tamanho="gg" centavos={false} animar />
            <span className="dr-heroi-lucro" data-tom={numeros.lucro < 0 ? "negativo" : "positivo"}>
              lucro <Valor valor={numeros.lucro} tamanho="p" centavos={false} />
            </span>
            {numeros.pedidos !== null && <span className="dr-heroi-extra">{numeros.pedidos === 1 ? "1 pedido" : `${numeros.pedidos} pedidos`}</span>}
          </span>
          <CurvaDaSemana dias={numeros.semana} ultimoEhHoje={numeros.ultimoEhHoje} />
        </Link>

        <section className="cos-bloco dr-para-voce" aria-labelledby="dr-pv">
          <h2 id="dr-pv" className="dr-rotulo">Para você <span className="dr-conta">{pendencias.length}</span></h2>
          <ul className="dr-lista">
            {pendencias.map((p) => (
              <li key={p.id}>
                <Link to={p.para} className="dr-lista-item">
                  <span>{p.titulo}</span>
                  <SetaCirculo />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <nav className="dr-tiras" aria-label="Resumo">
        <Link to="/negocios" className="dr-tira">
          <span className="dr-rotulo">Vape Mania</span>
          <strong><i className="dr-ponto" data-tom="ok" aria-hidden="true" />No ar</strong>
        </Link>
        <Link to="/negocios" className="dr-tira">
          <span className="dr-rotulo">DREND</span>
          <strong><i className="dr-ponto" data-tom="acento" aria-hidden="true" />{drendStatus.fase}</strong>
        </Link>
        <Link to="/vida" className="dr-tira">
          <span className="dr-rotulo">Próximo · {hora}</span>
          <strong>{compromisso}</strong>
        </Link>
      </nav>
    </>
  );
}
