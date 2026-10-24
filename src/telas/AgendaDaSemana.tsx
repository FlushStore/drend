import { diaDe, doDia, horaDe } from "@/core/agenda";
import { eventosDa, motivoSemAgenda, useAgenda } from "@/fontes/agenda";

const nome = (dia: string, i: number) =>
  i === 0 ? "Hoje" : i === 1 ? "Amanhã" : new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace("-feira", "").replace(/^./, (x) => x.toUpperCase());

/** Os próximos 7 dias da agenda do Google: só os dias com compromisso. */
export function AgendaDaSemana() {
  const estado = useAgenda();
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
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(agora);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return diaDe(d);
  });
  const comAlgo = dias.map((dia, i) => ({ dia, i, cs: doDia(eventos, dia).filter((c) => i > 0 || c.diaInteiro || new Date(c.fim) > agora) })).filter((d) => d.cs.length);
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
              <li key={c.id}>
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
