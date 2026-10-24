import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { Aviso } from "@/design-system/Aviso";
import { SetaCirculo } from "@/design-system/BotaoCirculo";
import { useAviso } from "@/design-system/useAviso";
import { abertas } from "@/core/tarefas";
import { Valor } from "@/design-system/Valor";
import { agenda, drendStatus } from "@/data/exemplo";
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
  const { caixaDeEntrada, tarefas, criarTarefa, concluirTarefa, reabrirTarefa } = useStore();
  const numeros = useFlush();
  const { aviso, avisar, limpar } = useAviso();
  const [nova, setNova] = useState("");
  const agora = new Date();
  const longa = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const data = longa.charAt(0).toUpperCase() + longa.slice(1);
  const lista = abertas(tarefas);
  const total = lista.length + caixaDeEntrada.length;
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
          <h2 id="dr-pv" className="dr-rotulo">Para você {total > 0 && <span className="dr-conta">{total}</span>}</h2>
          <ul className="dr-lista">
            {lista.map((t) => (
              <li key={t.id} className="dr-lista-item dr-tarefa">
                <button
                  type="button"
                  className="dr-tarefa-check"
                  aria-label={`Concluir: ${t.texto}`}
                  onClick={() => {
                    concluirTarefa(t.id);
                    avisar("Feito", "sucesso", { rotulo: "Desfazer", aoTocar: () => reabrirTarefa(t.id) });
                  }}
                >
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <span className="dr-tarefa-texto">{t.texto}</span>
              </li>
            ))}
            {caixaDeEntrada.map((ideia, i) => (
              <li key={`ideia-${i}`}>
                <Link to="/drend" className="dr-lista-item">
                  <span><small className="dr-lista-tipo">Ideia</small>{ideia}</span>
                  <SetaCirculo />
                </Link>
              </li>
            ))}
          </ul>
          {total === 0 && <p className="dr-vazio">Nada esperando por você.</p>}
          <form
            className="dr-tarefa-nova"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nova.trim()) return;
              criarTarefa(nova);
              setNova("");
            }}
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <label className="dr-tarefa-nova-campo">
              <span className="cos-sr">Nova tarefa</span>
              <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova tarefa" enterKeyHint="done" />
            </label>
          </form>
        </section>
      </div>

      <nav className="dr-tiras" aria-label="Resumo">
        <Link to="/negocios" className="dr-tira">
          <span className="dr-rotulo">Flush · 7 dias{numeros.exemplo && <span className="dr-tag-exemplo">exemplo</span>}</span>
          <strong><Valor valor={numeros.semana.reduce((t, d) => t + d.valor, 0)} tamanho="p" centavos={false} /></strong>
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
      <Aviso aviso={aviso} aoSumir={limpar} />
    </>
  );
}
