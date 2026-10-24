import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Trash2 } from "lucide-react";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { Valor } from "@/design-system/Valor";
import { Aviso } from "@/design-system/Aviso";
import { useAviso } from "@/design-system/useAviso";
import { classesDoBotao } from "@/design-system/classes";
import { tomDoSinal } from "@/design-system/formato";
import { gastosPorCategoria, nomeDoLancamento, saldoDoMes, ultimos } from "@/core/dinheiro";
import { feitoNoDia, sequencia, textoDaSequencia, ultimos7 } from "@/core/habitos";
import { diaEmBrasilia, meioDiaEmBrasilia, msAteAmanha } from "@/core/brasilia";
import { useStore } from "@/store";
import { AgendaDaSemana } from "./AgendaDaSemana";
import { ContasDoMes } from "./ContasDoMes";

const FUSO = "America/Sao_Paulo";
const quando = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "short" }).replace(".", "")}, ${d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" })}`;
};
const letraDoDia = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "narrow" }).toUpperCase();
const nomeDoDia = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric" });

/** Vida: dinheiro pessoal, contas do mês e hábitos (o que o Rapha conta) e a agenda. Só dado real: sem lançamento, a tela ensina a lançar. */
export function Vida() {
  // Um aviso só para a tela: o Desfazer de dinheiro e de hábito aparece no mesmo lugar.
  const { aviso, avisar, limpar } = useAviso();
  // Um "hoje" só para a tela: hábitos e contas viram o dia juntos.
  const hoje = useDiaEmBrasilia();
  return (
    <>
      <CabecalhoDeTela titulo="Vida" />
      <div className="dr-vida">
        <div className="dr-vida-coluna">
          <Dinheiro avisar={avisar} />
          <ContasDoMes hoje={hoje} avisar={avisar} />
        </div>
        <Habitos avisar={avisar} hoje={hoje} />
      </div>
      <AgendaDaSemana />
      <Aviso aviso={aviso} aoSumir={limpar} />
    </>
  );
}

type Avisar = ReturnType<typeof useAviso>["avisar"];

/**
 * O "hoje" de Brasília, reativo: vira à meia-noite e é conferido de novo quando o app
 * volta ao primeiro plano (no iPhone o relógio para com a tela em segundo plano).
 */
function useDiaEmBrasilia(): string {
  const [dia, setDia] = useState(() => diaEmBrasilia(new Date()));
  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout>;
    const conferir = () => {
      clearTimeout(relogio);
      setDia(diaEmBrasilia(new Date()));
      relogio = setTimeout(conferir, msAteAmanha() + 1000);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    relogio = setTimeout(conferir, msAteAmanha() + 1000);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", conferir);
    return () => {
      clearTimeout(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", conferir);
    };
  }, []);
  return dia;
}

function Dinheiro({ avisar }: { avisar: Avisar }) {
  const { lancamentos, apagarLancamento, restaurarLancamento } = useStore();
  const agora = new Date();
  const mes = agora.toLocaleDateString("pt-BR", { timeZone: FUSO, month: "long" });
  const nomeMes = mes.charAt(0).toUpperCase() + mes.slice(1);

  if (!lancamentos.length) {
    return (
        <EstadoVazio
          className="dr-vida-vazio"
          titulo="Dinheiro"
          texto={<>Diga no chat: “gastei 50 no mercado” ou “recebi 300 do freela”. O saldo do mês e para onde foi o dinheiro aparecem aqui.</>}
          acao={<Link to="/drend" className={classesDoBotao("secundaria")}>Abrir a conversa</Link>}
        />
    );
  }

  const s = saldoDoMes(lancamentos, agora);
  const categorias = gastosPorCategoria(lancamentos, agora);
  const maior = categorias[0]?.total ?? 0;
  const recentes = ultimos(lancamentos, 8);

  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-vida-dinheiro">
      <h2 id="dr-vida-dinheiro" className="dr-rotulo">Dinheiro · {nomeMes}</h2>
      <div className="dr-vida-saldo">
        <Valor valor={s.saldo} tamanho="gg" tom={tomDoSinal(s.saldo)} animar />
        <p className="dr-vida-saldo-partes">
          <span>Entrou <Valor valor={s.entradas} tamanho="p" /></span>
          <span>Saiu <Valor valor={s.gastos} tamanho="p" /></span>
        </p>
        {!s.n && <p className="dr-vazio">Nada lançado em {mes} ainda.</p>}
      </div>

      {categorias.length > 0 && (
        <>
          <h3 className="dr-rotulo dr-vida-sub">Para onde foi</h3>
          <ul className="dr-lista">
            {categorias.map((c) => (
              <li key={c.categoria} className="dr-vida-categoria">
                <span className="dr-vida-linha">
                  <span className="dr-tarefa-texto">{c.rotulo}{c.n > 1 && <small className="dr-vida-n"> · {c.n}×</small>}</span>
                  <Valor valor={c.total} tamanho="p" />
                </span>
                <span className="dr-vida-barra" aria-hidden="true"><i style={{ width: `${maior ? Math.max(4, (c.total / maior) * 100) : 0}%` }} /></span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="dr-rotulo dr-vida-sub">Últimos lançamentos</h3>
      <ul className="dr-lista">
        {recentes.map((l) => (
          <li key={l.id} className="dr-lista-item dr-vida-lancamento">
            <span className="dr-tarefa-texto">
              <small className="dr-lista-tipo" data-tipo={l.tipo}>{l.tipo === "gasto" ? "Gasto" : "Entrada"} · {quando(l.em)}</small>
              {nomeDoLancamento(l)}
            </span>
            <span className="dr-vida-valor">
              <Valor valor={l.tipo === "gasto" ? -l.valor : l.valor} tamanho="p" tom={l.tipo === "gasto" ? "negativo" : "positivo"} />
              <button
                type="button"
                className="dr-vida-apagar"
                aria-label={`Apagar ${nomeDoLancamento(l)}`}
                onClick={() => {
                  apagarLancamento(l.id);
                  avisar("Lançamento apagado", "sucesso", { rotulo: "Desfazer", aoTocar: () => restaurarLancamento(l) });
                }}
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="dr-vida-dica">Para lançar, diga no chat: “gastei 12,90 com uber”.</p>
    </section>
  );
}

function Habitos({ avisar, hoje }: { avisar: Avisar; hoje: string }) {
  const { habitos, criarHabito, alternarHabitoHoje, apagarHabito, restaurarHabito } = useStore();
  const [novo, setNovo] = useState("");
  // Tela e toque usam o mesmo dia: o que aparece como hoje é o dia que o toque marca.
  const agora = meioDiaEmBrasilia(hoje);

  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-vida-habitos">
      <h2 id="dr-vida-habitos" className="dr-rotulo">Hábitos {habitos.length > 0 && <span className="dr-conta">{habitos.filter((h) => feitoNoDia(h, hoje)).length}/{habitos.length}</span>}</h2>
      {habitos.length === 0 ? (
        <p className="dr-vazio">Nenhum hábito ainda. Crie aqui embaixo ou diga no chat: “novo hábito academia”.</p>
      ) : (
        <ul className="dr-lista">
          {habitos.map((h) => {
            const feito = feitoNoDia(h, hoje);
            const n = sequencia(h, agora);
            return (
              <li key={h.id} className="dr-lista-item dr-habito">
                <button
                  type="button"
                  className="dr-tarefa-check"
                  data-feito={feito || undefined}
                  aria-pressed={feito}
                  aria-label={feito ? `Desmarcar hoje: ${h.nome}` : `Feito hoje: ${h.nome}`}
                  onClick={() => {
                    alternarHabitoHoje(h.id, hoje);
                    if (!feito) avisar(`${h.nome}: feito hoje`, "sucesso", { rotulo: "Desfazer", aoTocar: () => alternarHabitoHoje(h.id, hoje) });
                  }}
                >
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <div className="dr-tarefa-texto dr-habito-nome">
                  {h.nome}
                  <small className="dr-vida-n">{textoDaSequencia(n)}</small>
                <ol className="dr-habito-dias" aria-label={`Últimos 7 dias de ${h.nome}`}>
                  {ultimos7(h, agora).map((d) => (
                    <li key={d.dia} data-feito={d.feito || undefined} data-hoje={d.dia === hoje || undefined} title={nomeDoDia(d.dia)}>
                      <span aria-hidden="true">{letraDoDia(d.dia)}</span>
                      <span className="cos-sr">{nomeDoDia(d.dia)}: {d.feito ? "feito" : "não feito"}</span>
                    </li>
                  ))}
                </ol>
                </div>
                <button
                  type="button"
                  className="dr-vida-apagar"
                  aria-label={`Apagar o hábito ${h.nome}`}
                  onClick={() => {
                    apagarHabito(h.id);
                    avisar(`Hábito “${h.nome}” apagado`, "sucesso", { rotulo: "Desfazer", aoTocar: () => restaurarHabito(h) });
                  }}
                >
                  <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="dr-tarefa-nova"
        onSubmit={(e) => {
          e.preventDefault();
          if (!novo.trim()) return;
          criarHabito(novo);
          setNovo("");
        }}
      >
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        <label className="dr-tarefa-nova-campo">
          <span className="cos-sr">Novo hábito</span>
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo hábito" enterKeyHint="done" />
        </label>
      </form>
    </section>
  );
}
