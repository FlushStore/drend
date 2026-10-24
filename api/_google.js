// Eventos do conector do Google Agenda (formato da API: start.date / start.dateTime) →
// compromissos do DREND. Dia inteiro e hora sem fuso valem no fuso de Brasília.
import { FUSO_PADRAO, instante } from "./_ics.js";

const DIA = 864e5;
const MAX = 500;

function dataDe(v) {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

function momento(v, tz) {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return null;
  if (m[7]) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  return instante(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)), tz);
}

/** Dia (AAAA-MM-DD) daquele instante no fuso. */
function diaNoFuso(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const curto = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/** Lista de compromissos em ordem; ignora cancelados e o que não tem data. */
export function normalizar(eventos, tz = FUSO_PADRAO) {
  if (!Array.isArray(eventos)) return null;
  const saida = [];
  for (const e of eventos.slice(0, MAX)) {
    if (!e || typeof e !== "object" || e.status === "cancelled") continue;
    const s = e.start ?? {};
    const f = e.end ?? {};
    const diaInteiro = !s.dateTime && !!s.date;
    let ini;
    let fim;
    let dia;
    if (diaInteiro) {
      const d = dataDe(s.date);
      if (d === null) continue;
      const df = dataDe(f.date);
      ini = instante(d, tz);
      fim = instante(df !== null && df > d ? df : d + DIA, tz);
      dia = new Date(d).toISOString().slice(0, 10);
    } else {
      ini = momento(s.dateTime, s.timeZone || tz);
      if (ini === null) continue;
      const mf = momento(f.dateTime, f.timeZone || s.timeZone || tz);
      fim = mf !== null && mf >= ini ? mf : ini;
      dia = diaNoFuso(ini, tz);
    }
    saida.push({
      id: `g|${curto(e.id, 200) ?? ini}`,
      titulo: curto(e.summary, 200) ?? "(sem título)",
      local: curto(e.location, 200),
      inicio: new Date(ini).toISOString(),
      fim: new Date(fim).toISOString(),
      diaInteiro,
      dia,
    });
  }
  return saida.sort((a, b) => a.inicio.localeCompare(b.inicio) || Number(b.diaInteiro) - Number(a.diaInteiro));
}
