import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { Aviso } from "@/design-system/Aviso";
import { SetaCirculo } from "@/design-system/BotaoCirculo";
import { useAviso } from "@/design-system/useAviso";
import { abertas } from "@/core/tarefas";
import { Valor } from "@/design-system/Valor";
import { agenda } from "@/data/exemplo";
import { DIAS_PARADO, projetos } from "@/core/missao";
import { useMissoes } from "@/fontes/missoes";
import { useStatusVM } from "@/fontes/status";
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
  const vm = useStatusVM();
  const missoes = useMissoes();
  const resumoMissoes = (() => {
    if (missoes.fase !== "ok") return { agora: 0, parados: 0, texto: "Abrir" };
    const ps = projetos(missoes.eventos);
    const agora = ps.reduce((t, p) => t + p.itens.agora.length, 0);
    const parados = ps.filter((p) => p.parado !== null && p.parado >= DIAS_PARADO).length;
    return { agora, parados, texto: parados ? `${parados} parado${parados > 1 ? "s" : ""}` : `${agora} em andamento` };
  })();
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
          <span className="dr-rotulo">Vape Mania</span>
          <strong><i className="dr-ponto" data-tom={vm.site.ok === null ? undefined : vm.site.ok && vm.banco.ok ? "ok" : "alerta"} aria-hidden="true" />{vm.site.ok === null ? "Verificando" : !vm.site.ok ? "Site fora do ar" : !vm.banco.ok ? "Banco sem resposta" : "No ar"}</strong>
        </Link>
        <Link to="/missoes" className="dr-tira">
          <span className="dr-rotulo">Missões</span>
          <strong><i className="dr-ponto" data-tom={resumoMissoes.parados ? "alerta" : resumoMissoes.agora ? "acento" : undefined} aria-hidden="true" />{resumoMissoes.texto}</strong>
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
