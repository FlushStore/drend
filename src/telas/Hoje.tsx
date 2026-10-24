import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { Aviso } from "@/design-system/Aviso";
import { SetaCirculo } from "@/design-system/BotaoCirculo";
import { useAviso } from "@/design-system/useAviso";
import { abertas } from "@/core/tarefas";
import { Valor } from "@/design-system/Valor";
import { diaDe, horaDe, proximo } from "@/core/agenda";
import { eventosDa, useAgenda } from "@/fontes/agenda";
import { estaParado, projetos } from "@/core/missao";
import { useMissoes } from "@/fontes/missoes";
import { useStatusVM } from "@/fontes/status";
import { useFlush } from "@/fontes/useFlush";
import { META_FLUSH_MES, useStore } from "@/store";
import { moneyBRL } from "@/lib/store-utils";
import { CurvaDaSemana } from "./VendasDaSemana";
import { cortarAtencao, montarAtencao, textoDosEsgotados, type ItemDeAtencao } from "@/core/atencao";
import { useDiaEmBrasilia } from "@/lib/useDiaEmBrasilia";

function saudacao(agora: Date) {
  const h = agora.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Hoje: uma frase, um número e o que espera você. O resto mora nas outras abas.
 * Regra do painel da Flush: um herói por tela, nada de texto explicando a tela.
 */
export function Hoje() {
  const { caixaDeEntrada, tarefas, criarTarefa, concluirTarefa, reabrirTarefa, metas, contas, habitos, pagarConta, desfazerPagamento, alternarHabitoHoje } = useStore();
  const numeros = useFlush();
  const vm = useStatusVM();
  const missoes = useMissoes();
  const resumoMissoes = (() => {
    if (missoes.fase !== "ok") return { agora: 0, parados: 0, texto: "Abrir" };
    const ps = projetos(missoes.eventos);
    const agora = ps.reduce((t, p) => t + p.itens.agora.length, 0);
    const parados = ps.filter(estaParado).length;
    return { agora, parados, texto: parados ? `${parados} parado${parados > 1 ? "s" : ""}` : `${agora} em andamento` };
  })();
  const { aviso, avisar, limpar } = useAviso();
  const [nova, setNova] = useState("");
  // O dia de Brasília vira à meia-noite; o minuto mantém o "compromisso já já" em dia.
  const hoje = useDiaEmBrasilia();
  const [, setMinuto] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinuto((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const agora = new Date();
  const longa = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const data = longa.charAt(0).toUpperCase() + longa.slice(1);
  const lista = abertas(tarefas);
  const agendaEstado = useAgenda();
  const eventos = eventosDa(agendaEstado);
  const acabando = numeros.produtos?.acabando;
  const atencao = cortarAtencao(
    montarAtencao({ contas, habitos, compromissos: eventos, esgotados: acabando ? acabando.filter((x) => x.quantidade === 0).length : null, agora }),
  );
  const total = atencao.visiveis.length + atencao.escondidos + lista.length + caixaDeEntrada.length;

  function tocar(i: ItemDeAtencao) {
    if (i.tipo === "conta") {
      const p = pagarConta(i.contaId);
      if (p) avisar(p.lancamento ? `${i.nome} paga · gasto lançado` : `${i.nome} paga`, "sucesso", { rotulo: "Desfazer", aoTocar: () => desfazerPagamento(i.contaId, p.mes) });
    } else if (i.tipo === "habito") {
      alternarHabitoHoje(i.habitoId, hoje);
      avisar(`${i.nome}: feito hoje`, "sucesso", { rotulo: "Desfazer", aoTocar: () => alternarHabitoHoje(i.habitoId, hoje) });
    }
  }
  const prox = eventos ? proximo(eventos, agora) : null;
  const amanha = (() => { const d = new Date(agora); d.setHours(12); d.setDate(d.getDate() + 1); return diaDe(d); })();
  const tiraAgenda = prox
    ? {
        rotulo: `Próximo · ${prox.dia === diaDe(agora) ? "" : prox.dia === amanha ? "amanhã " : new Date(`${prox.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") + " "}${prox.diaInteiro ? "dia todo" : new Date(prox.inicio) <= agora ? "agora" : horaDe(prox.inicio)}`,
        texto: prox.titulo,
      }
    : { rotulo: "Agenda", texto: eventos ? "Nada marcado" : agendaEstado.fase === "sem-agenda" ? "Ligar a agenda" : agendaEstado.fase === "carregando" ? "Lendo…" : "Entrar" };

  return (
    <>
      <header className="dr-ola">
        <p className="dr-ola-data">{data} · <Link to="/semana" className="dr-ola-semana">Sua semana</Link></p>
        <h1 className="dr-ola-titulo">{saudacao(agora)}, <em>Rapha</em>.</h1>
      </header>

      <div className="dr-hoje">
        <Link to="/negocios" className="cos-bloco dr-heroi" aria-label={`FlushStore ${numeros.dia}: faturamento e lucro`}>
          <span className="dr-rotulo">
            FlushStore · {numeros.dia}
          </span>
          {numeros.semLeitura ? (
            <p className="dr-vazio">{numeros.estado.fase === "carregando" ? "Lendo as vendas…" : "Sem leitura da Flush. Ligue em Sua conta."}</p>
          ) : (
            <>
              <span className="dr-heroi-num">
                <Valor valor={numeros.hoje} tamanho="gg" centavos={false} animar />
                <span className="dr-heroi-lucro" data-tom={numeros.lucro < 0 ? "negativo" : "positivo"}>
                  lucro <Valor valor={numeros.lucro} tamanho="p" centavos={false} />
                </span>
                {numeros.pedidos !== null && <span className="dr-heroi-extra">{numeros.pedidos === 1 ? "1 pedido" : `${numeros.pedidos} pedidos`}</span>}
              </span>
              <CurvaDaSemana dias={numeros.semana} ultimoEhHoje={numeros.ultimoEhHoje} />
            </>
          )}
        </Link>

        <section className="cos-bloco dr-para-voce" aria-labelledby="dr-pv">
          <h2 id="dr-pv" className="dr-rotulo">Para você {total > 0 && <span className="dr-conta">{total}</span>}</h2>
          <ul className="dr-lista">
            {atencao.visiveis.map((i) =>
              i.tipo === "conta" || i.tipo === "habito" ? (
                <li key={i.chave} className="dr-lista-item dr-tarefa">
                  <button
                    type="button"
                    className="dr-tarefa-check"
                    aria-label={i.tipo === "conta" ? `Marcar paga: ${i.nome}` : `Feito hoje: ${i.nome}`}
                    onClick={() => tocar(i)}
                  >
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <span className="dr-tarefa-texto">
                    <small className="dr-lista-tipo" data-estado={i.tipo === "conta" ? i.estado : undefined}>{i.rotulo}</small>
                    {i.nome}
                  </span>
                  {i.tipo === "conta" && i.valor !== null && <span className="dr-atencao-valor"><Valor valor={i.valor} tamanho="p" /></span>}
                </li>
              ) : (
                <li key={i.chave}>
                  <Link to={i.tela} className="dr-lista-item">
                    <span>
                      <small className="dr-lista-tipo" data-estado={i.tipo === "compromisso" && i.comecou ? "hoje" : undefined}>{i.rotulo}</small>
                      {i.tipo === "compromisso" ? i.titulo : textoDosEsgotados(i.n)}
                    </span>
                    <SetaCirculo />
                  </Link>
                </li>
              ),
            )}
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
          {atencao.verTudo && (
            <Link to={atencao.verTudo} className="dr-ver-tudo">
              Ver tudo <small>+{atencao.escondidos}</small>
            </Link>
          )}
          {total === 0 && <p className="dr-vazio">Tudo em dia.</p>}
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

      <nav className="dr-tiras" data-n={numeros.mes ? 4 : 3} aria-label="Resumo">
        {numeros.mes && (
          <Link to="/negocios" className="dr-tira">
            <span className="dr-rotulo">Flush · {numeros.mes.nome}</span>
            <strong>
              {moneyBRL(Math.round(numeros.mes.atual.valor)).replace(/,00$/, "")}
              {metas[META_FLUSH_MES] ? <small className="dr-tira-extra"> · {Math.round((numeros.mes.atual.valor / metas[META_FLUSH_MES]) * 100)}% da meta</small> : null}
            </strong>
          </Link>
        )}
        <Link to="/negocios" className="dr-tira">
          <span className="dr-rotulo">Vape Mania</span>
          <strong><i className="dr-ponto" data-tom={vm.site.ok === null ? undefined : vm.site.ok && vm.banco.ok ? "ok" : "alerta"} aria-hidden="true" />{vm.site.ok === null ? "Verificando" : !vm.site.ok ? "Site fora do ar" : !vm.banco.ok ? "Banco sem resposta" : "No ar"}</strong>
        </Link>
        <Link to="/missoes" className="dr-tira">
          <span className="dr-rotulo">Missões</span>
          <strong><i className="dr-ponto" data-tom={resumoMissoes.parados ? "alerta" : resumoMissoes.agora ? "acento" : undefined} aria-hidden="true" />{resumoMissoes.texto}</strong>
        </Link>
        <Link to="/vida" className="dr-tira">
          <span className="dr-rotulo">{tiraAgenda.rotulo}</span>
          <strong>{tiraAgenda.texto}</strong>
        </Link>
      </nav>
      <Aviso aviso={aviso} aoSumir={limpar} />
    </>
  );
}
