import { Link } from "react-router-dom";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { Delta } from "@/design-system/Delta";
import { Valor } from "@/design-system/Valor";
import { tomDoSinal } from "@/design-system/formato";
import { eventosDa, useAgenda } from "@/fontes/agenda";
import { useFlush, type NumerosFlush } from "@/fontes/useFlush";
import { periodoDaFlush, semanaDaFlush, semanaDasTarefas, semanaDoDinheiro, semanaDosHabitos, seteDias } from "@/core/semana";
import { textoDaSequencia } from "@/core/habitos";
import { moneyBRL } from "@/lib/store-utils";
import { useStore } from "@/store";
import { AgendaDaSemana } from "./AgendaDaSemana";
import { CurvaDaSemana } from "./VendasDaSemana";

const sem0 = (v: number) => moneyBRL(Math.round(v)).replace(/,00$/, "");
const diaLongo = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
const dataCurta = (dia: string, mes: boolean) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "numeric", ...(mes ? { month: "long" } : {}) });

/** "18 a 24 de outubro" · "28 de setembro a 4 de outubro". */
function periodo(dias: readonly string[]): string {
  const [ini, fim] = [dias[0], dias[dias.length - 1]];
  return `${dataCurta(ini, ini.slice(5, 7) !== fim.slice(5, 7))} a ${dataCurta(fim, true)}`;
}

/** Revisão da semana: os últimos 7 dias de tudo que o DREND já lê e os próximos 7 da agenda. Só dado real. */
export function Semana() {
  const flush = useFlush();
  const dias = seteDias();
  const temAgenda = eventosDa(useAgenda()) !== null;
  return (
    <>
      <CabecalhoDeTela titulo="Semana" sub={periodo(dias)} />
      <div className="dr-semana">
        <FlushDaSemana flush={flush} />
        <Tarefas />
        <Habitos />
        <Dinheiro />
      </div>
      {temAgenda && <h2 className="dr-rotulo dr-semana-agenda">Próximos 7 dias</h2>}
      <AgendaDaSemana />
    </>
  );
}

function FlushDaSemana({ flush }: { flush: NumerosFlush }) {
  const s = flush.semLeitura ? null : semanaDaFlush(flush.historico, flush.diasCompletos, flush.produtos?.maisVendidos ?? null);
  const atualizando = flush.estado.fase === "carregando" || (flush.estado.fase === "ok" && flush.estado.atualizando);
  let maisVendido: string;
  if (s?.maisVendido) maisVendido = s.maisVendido.nome;
  else if (flush.produtos) maisVendido = "Sem venda";
  else maisVendido = atualizando ? "Lendo…" : "Só com a Flush ligada aqui";

  return (
    <section className="cos-bloco dr-heroi dr-semana-flush" aria-labelledby="dr-sem-flush">
      <h2 id="dr-sem-flush" className="dr-rotulo">FlushStore · {(s && periodoDaFlush(s)) ?? "7 dias"}</h2>
      {!s ? (
        <p className="dr-vazio">{flush.estado.fase === "carregando" ? "Lendo as vendas…" : "Sem leitura da Flush. Ligue em Sua conta."}</p>
      ) : (
        <>
          <span className="dr-heroi-num">
            <Valor valor={s.faturamento.atual} tamanho="gg" centavos={false} animar />
            <Delta atual={s.faturamento.atual} anterior={s.faturamento.anterior} rotulo="os 7 dias antes" curto="7 dias antes" />
          </span>
          <dl className="dr-numeros dr-semana-numeros">
            <div>
              <dt>Lucro</dt>
              <dd><Valor valor={s.lucro.atual} tamanho="m" centavos={false} tom={s.lucro.atual < 0 ? "negativo" : undefined} /></dd>
              <dd><Delta atual={s.lucro.atual} anterior={s.lucro.anterior} rotulo="o lucro dos 7 dias antes" curto="antes" /></dd>
            </div>
            <div>
              <dt>Pedidos</dt>
              <dd className="dr-mes-num">{s.pedidos.atual}</dd>
              <dd><Delta atual={s.pedidos.atual} anterior={s.pedidos.anterior} formato="inteiro" rotulo="os pedidos dos 7 dias antes" curto="antes" /></dd>
            </div>
            <div>
              <dt>Melhor dia</dt>
              <dd className="dr-mes-num">{s.melhorDia ? diaLongo(s.melhorDia.dia) : "—"}</dd>
              {s.melhorDia && <dd className="dr-semana-detalhe">{sem0(s.melhorDia.valor)}</dd>}
            </div>
            <div>
              <dt>Mais vendido</dt>
              <dd className="dr-mes-num dr-semana-produto">{maisVendido}</dd>
              {s.maisVendido && <dd className="dr-semana-detalhe">{s.maisVendido.unidades === 1 ? "1 unidade" : `${s.maisVendido.unidades} unidades`}</dd>}
            </div>
          </dl>
          <CurvaDaSemana dias={s.dias} ultimoEhHoje={flush.ultimoEhHoje} />
        </>
      )}
    </section>
  );
}

function Tarefas() {
  const { tarefas } = useStore();
  const t = semanaDasTarefas(tarefas);
  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-sem-tarefas">
      <h2 id="dr-sem-tarefas" className="dr-rotulo">Tarefas</h2>
      {!tarefas.length ? (
        <p className="dr-vazio">Nenhuma tarefa ainda. Anote em Hoje ou diga no chat: “me lembra de…”.</p>
      ) : (
        <dl className="dr-numeros dr-semana-contas">
          <div><dt>Concluídas</dt><dd className="dr-semana-conta">{t.feitas}</dd></div>
          <div><dt>Abertas</dt><dd className="dr-semana-conta"><Link to="/">{t.abertas}</Link></dd></div>
        </dl>
      )}
    </section>
  );
}

function Habitos() {
  const { habitos } = useStore();
  const hs = semanaDosHabitos(habitos);
  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-sem-habitos">
      <h2 id="dr-sem-habitos" className="dr-rotulo">Hábitos</h2>
      {!hs.length ? (
        <p className="dr-vazio">Nenhum hábito ainda. Crie em <Link to="/vida">Vida</Link>.</p>
      ) : (
        <ul className="dr-lista">
          {hs.map((h) => (
            <li key={h.id} className="dr-vida-categoria">
              <span className="dr-vida-linha">
                <span className="dr-tarefa-texto">{h.nome}</span>
                <span className="dr-semana-parte">{h.feitos}/{h.dias} · {Math.round(h.parte * 100)}%</span>
              </span>
              <span className="dr-vida-barra" aria-hidden="true"><i style={{ width: `${Math.round(h.parte * 100)}%` }} /></span>
              <small className="dr-vida-n">{textoDaSequencia(h.atual)} · recorde {h.recorde === 1 ? "1 dia" : `${h.recorde} dias`}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Dinheiro() {
  const { lancamentos } = useStore();
  const d = semanaDoDinheiro(lancamentos);
  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-sem-dinheiro">
      <h2 id="dr-sem-dinheiro" className="dr-rotulo">Dinheiro · 7 dias</h2>
      {!d.n ? (
        <p className="dr-vazio">Nada lançado nos últimos 7 dias. Diga no chat: “gastei 50 no mercado”.</p>
      ) : (
        <div className="dr-vida-saldo">
          <Valor valor={d.saldo} tamanho="g" tom={tomDoSinal(d.saldo)} />
          <p className="dr-vida-saldo-partes">
            <span>Entrou <Valor valor={d.entradas} tamanho="p" /></span>
            <span>Saiu <Valor valor={d.gastos} tamanho="p" /></span>
          </p>
          {d.maiorGasto && (
            <p className="dr-vida-saldo-partes">
              <span>Mais em {d.maiorGasto.rotulo} <Valor valor={d.maiorGasto.total} tamanho="p" /></span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
