import { useSearchParams } from "react-router-dom";
import { diasDaAgenda, horaDe } from "@/core/agenda";
import { eventosDa, motivoSemAgenda, useAgenda } from "@/fontes/agenda";

const nome = (dia: string, i: number) =>
  i === 0 ? "Hoje" : i === 1 ? "Amanhã" : new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace("-feira", "").replace(/^./, (x) => x.toUpperCase());

/**
 * Os próximos 7 dias da agenda do Google: só os dias com compromisso. Com `?compromisso=id`
 * (vindo da busca), mostra também o dia desse compromisso, mesmo fora da semana ou já encerrado.
 */
export function AgendaDaSemana() {
  const estado = useAgenda();
  const [params] = useSearchParams();
  const focoId = params.get("compromisso");
  const eventos = eventosDa(estado);
  const agora = new Date();
  if (!eventos) {
    if (estado.fase === "carregando") return null;
    return (
      <section className="dr-dia" aria-label="Agenda">
        <h2 className="dr-rotulo">Agenda</h2>
        <p className="dr-vazio">{motivoSemAgenda(estado)}</p>
      </section>
    );
  }
  const comAlgo = diasDaAgenda(eventos, agora, focoId);
  if (!comAlgo.length) {
    return (
      <section className="dr-dia" aria-label="Agenda">
        <h2 className="dr-rotulo">Agenda</h2>
        <p className="dr-vazio">Nada marcado nos próximos 7 dias.</p>
      </section>
    );
  }
  return (
    <>
      {comAlgo.map(({ dia, i, cs }) => (
        <section key={dia} className="dr-dia" aria-label={`Agenda, ${nome(dia, i)}`}>
          <h2 className="dr-rotulo">{nome(dia, i)}</h2>
          <ol className="dr-dia-lista">
            {cs.map((c) => (
              <li key={c.id} data-compromisso={c.id}>
                <time dateTime={c.inicio}>{c.diaInteiro ? "dia" : horaDe(c.inicio)}</time>
                <span>{c.titulo}{c.local && <small className="dr-dia-local">{c.local}</small>}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
