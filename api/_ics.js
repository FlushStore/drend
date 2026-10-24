// Leitor de agenda no formato iCal (o "endereço secreto" do Google Agenda). Só leitura.
// Desdobra as recorrências (RRULE, EXDATE e exceções com RECURRENCE-ID) numa janela de dias.
// O arquivo começa com "_": a Vercel não publica como rota, só a /api/agenda usa.
import rrulePkg from "rrule";

const { RRule } = rrulePkg;
export const FUSO_PADRAO = "America/Sao_Paulo";

/** Linhas do iCal com as continuações (linha que começa com espaço) já coladas. */
function linhas(texto) {
  return String(texto).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

/** "DTSTART;TZID=America/Sao_Paulo:20261024T090000" → { nome, params, valor } */
function campo(linha) {
  const i = linha.indexOf(":");
  if (i < 0) return null;
  const [nome, ...ps] = linha.slice(0, i).split(";");
  const params = {};
  for (const p of ps) {
    const [k, v = ""] = p.split("=");
    params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return { nome: nome.toUpperCase(), params, valor: linha.slice(i + 1) };
}

const texto = (v) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function fusoValido(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Minutos que o fuso está à frente do UTC naquele instante. */
function deslocamento(tz, ms) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000;
}

/** Hora de parede (como no relógio daquele fuso) → instante real. */
export function instante(parede, tz) {
  const off = deslocamento(tz, parede);
  let t = parede - off * 60000;
  const off2 = deslocamento(tz, t);
  if (off2 !== off) t = parede - off2 * 60000;
  return t;
}

/** Instante real → hora de parede naquele fuso (em ms "como se fosse UTC"). */
const paraParede = (ms, tz) => ms + deslocamento(tz, ms) * 60000;

/** "20261024T090000Z" / "20261024T090000" / "20261024" → { parede (ms), utc, data } */
function lerData(c, fusoDoCalendario) {
  const m = c.valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const parede = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const data = c.params.VALUE === "DATE" || !m[4];
  if (m[7]) return { parede: paraParede(parede, fusoDoCalendario), data: false, tz: fusoDoCalendario };
  const tz = c.params.TZID && fusoValido(c.params.TZID) ? c.params.TZID : fusoDoCalendario;
  return { parede, data, tz };
}

/** Os VEVENTs do arquivo, com as datas em hora de parede do próprio fuso. */
export function lerEventos(ics) {
  const ls = linhas(ics);
  const xfuso = ls.map(campo).find((c) => c && c.nome === "X-WR-TIMEZONE");
  const fuso = xfuso && fusoValido(xfuso.valor.trim()) ? xfuso.valor.trim() : FUSO_PADRAO;
  const eventos = [];
  let atual = null;
  for (const l of ls) {
    if (l === "BEGIN:VEVENT") atual = { exdatas: [] };
    else if (l === "END:VEVENT") {
      if (atual?.inicio && atual.status !== "CANCELLED") eventos.push(atual);
      atual = null;
    } else if (atual) {
      const c = campo(l);
      if (!c) continue;
      if (c.nome === "UID") atual.uid = c.valor.trim();
      else if (c.nome === "SUMMARY") atual.titulo = texto(c.valor);
      else if (c.nome === "LOCATION") atual.local = texto(c.valor) || null;
      else if (c.nome === "STATUS") atual.status = c.valor.trim().toUpperCase();
      else if (c.nome === "DTSTART") atual.inicio = lerData(c, fuso);
      else if (c.nome === "DTEND") atual.fim = lerData(c, fuso);
      else if (c.nome === "RRULE") atual.rrule = c.valor.trim();
      else if (c.nome === "RECURRENCE-ID") atual.recorrencia = lerData(c, fuso);
      else if (c.nome === "EXDATE") for (const v of c.valor.split(",")) {
        const d = lerData({ ...c, valor: v.trim() }, fuso);
        if (d) atual.exdatas.push(d);
      }
    }
  }
  return { fuso, eventos };
}

const DIA = 864e5;
const diaDe = (ms) => new Date(ms).toISOString().slice(0, 10);
/** A chave de uma ocorrência: o instante real do começo (a data, em evento de dia inteiro). */
const chaveDe = (d) => (d.data ? diaDe(d.parede) : String(instante(d.parede, d.tz)));

/**
 * Compromissos entre `de` e `ate` (ms), em ordem, com o dia no fuso do calendário.
 * Ocorrência movida (RECURRENCE-ID) troca a original; EXDATE apaga.
 */
export function compromissos(ics, de, ate, limite = 300) {
  const { fuso, eventos } = lerEventos(ics);
  const excecoes = new Map();
  for (const e of eventos) if (e.recorrencia && e.uid) excecoes.set(`${e.uid}|${chaveDe(e.recorrencia)}`, e);
  const saida = [];

  function emitir(e, parede) {
    const tz = e.inicio.tz;
    const dur = e.fim ? e.fim.parede - e.inicio.parede : e.inicio.data ? DIA : 0;
    const ini = e.inicio.data ? instante(parede, fuso) : instante(parede, tz);
    const fim = e.inicio.data ? instante(parede + dur, fuso) : instante(parede + dur, e.fim?.tz ?? tz);
    if (fim <= de || ini >= ate) return;
    saida.push({
      id: `${e.uid ?? "x"}|${ini}`,
      titulo: e.titulo || "(sem título)",
      local: e.local ?? null,
      inicio: new Date(ini).toISOString(),
      fim: new Date(fim).toISOString(),
      diaInteiro: e.inicio.data,
      dia: e.inicio.data ? diaDe(parede) : diaDe(paraParede(ini, fuso)),
    });
  }

  for (const e of eventos) {
    if (e.recorrencia) {
      emitir(e, e.inicio.parede);
      continue;
    }
    if (!e.rrule) {
      emitir(e, e.inicio.parede);
      continue;
    }
    // Recorrência em hora de parede ("todo dia às 9h" continua às 9h): a regra roda com as
    // datas como se fossem UTC e cada ocorrência volta para o fuso no fim.
    let opcoes;
    try {
      opcoes = RRule.parseString(e.rrule);
    } catch {
      emitir(e, e.inicio.parede);
      continue;
    }
    // UNTIL com "Z" é um instante real; sem "Z", já é hora de parede.
    if (opcoes.until && !e.inicio.data && /UNTIL=\d{8}T\d{6}Z/i.test(e.rrule)) opcoes.until = new Date(paraParede(opcoes.until.getTime(), e.inicio.tz));
    const regra = new RRule({ ...opcoes, dtstart: new Date(e.inicio.parede), tzid: null });
    const margem = 2 * DIA;
    const fora = new Set(e.exdatas.map(chaveDe));
    for (const o of regra.between(new Date(paraParede(de, e.inicio.tz) - margem), new Date(paraParede(ate, e.inicio.tz) + margem), true)) {
      const parede = o.getTime();
      const chave = e.inicio.data ? diaDe(parede) : String(instante(parede, e.inicio.tz));
      if (fora.has(chave) || excecoes.has(`${e.uid}|${chave}`)) continue;
      emitir(e, parede);
      if (saida.length > limite * 2) break;
    }
  }
  return saida.sort((a, b) => a.inicio.localeCompare(b.inicio) || Number(b.diaInteiro) - Number(a.diaInteiro)).slice(0, limite);
}
