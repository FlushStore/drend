// Agenda do Rapha (Google Agenda, só leitura).
// POST: a tarefa agendada (a cada hora) manda os eventos lidos pelo conector do Google, com o
// token dos agentes; ficam na tabela drend_agenda. GET: o app lê com o login do Rapha (a
// função confere o e-mail no Supabase). O endereço secreto do iCal (AGENDA_ICS_URL) é opcional.
import { compromissos } from "./_ics.js";
import { normalizar } from "./_google.js";
import { autorizado } from "./_token.js";
import { banco, DONO, quemE } from "./_sessao.js";

const DIA = 864e5;
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

async function baixar(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "text/calendar" } });
    if (!r.ok) throw new Error(`agenda respondeu ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/** As linhas da drend_agenda (uma por fonte). */
async function sincronizadas(db) {
  const r = await fetch(`${db.url}/rest/v1/drend_agenda?select=fonte,eventos,atualizado_em`, { headers: db.cabecalhos });
  if (!r.ok) throw new Error(`banco respondeu ${r.status}`);
  return r.json();
}

async function gravar(req, res) {
  if (!autorizado(req)) return res.status(401).json({ erro: "token inválido" });
  const db = banco();
  if (!db) return res.status(500).json({ erro: "banco não configurado" });
  const corpo = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const fonte = corpo?.fonte ?? "google";
  if (!/^[a-z0-9-]{1,40}$/.test(fonte)) return res.status(400).json({ erro: "fonte inválida" });
  const eventos = normalizar(corpo?.eventos);
  if (!eventos) return res.status(400).json({ erro: "eventos precisa ser uma lista" });
  const r = await fetch(`${db.url}/rest/v1/drend_agenda?on_conflict=fonte`, {
    method: "POST",
    headers: { ...db.cabecalhos, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ fonte, eventos, atualizado_em: new Date().toISOString() }),
  });
  if (!r.ok) return res.status(r.status).json({ erro: "não consegui gravar" });
  cache = null;
  return res.status(200).json({ fonte, gravados: eventos.length });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "POST") return gravar(req, res);
  if (req.method !== "GET") return res.status(405).json({ erro: "use GET ou POST" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if ((await quemE(token)) !== DONO) return res.status(401).json({ erro: "entre na sua conta do DREND" });

  const agora = Date.now();
  if (cache && agora - cache.em < CACHE_MS && req.query.forcar !== "1") return res.status(200).json(cache.corpo);
  const de = agora - DIA / 2;
  const ate = agora + 15 * DIA;
  const fontes = String(process.env.AGENDA_ICS_URL || "").split(/[\s,]+/).filter((u) => /^https:\/\//.test(u));
  const db = banco();
  try {
    const linhas = db ? await sincronizadas(db) : [];
    if (!linhas.length && !fontes.length) return res.status(503).json({ codigo: "sem-agenda", erro: "agenda ainda não sincronizou" });
    const listas = await Promise.all(fontes.map(async (u) => compromissos(await baixar(u), de, ate)));
    const salvos = linhas.flatMap((l) => (Array.isArray(l.eventos) ? l.eventos : []));
    // A mesma agenda pode vir pela sincronia e pelo iCal, com ids diferentes: fica uma cópia
    // por título + início + fim (a da sincronia, que vem primeiro).
    const vistos = new Set();
    const eventos = [...salvos.filter((e) => Date.parse(e.fim) > de && Date.parse(e.inicio) < ate), ...listas.flat()]
      .filter((e) => {
        const chave = `${e.titulo}|${e.inicio}|${e.fim}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio) || Number(b.diaInteiro) - Number(a.diaInteiro));
    // Com só a sincronia, "atualizado" é a hora em que a tarefa gravou, não a hora desta leitura.
    const quando = fontes.length ? agora : Math.min(...linhas.map((l) => Date.parse(l.atualizado_em)));
    const corpo = { eventos, atualizadoEm: new Date(quando).toISOString() };
    cache = { em: agora, corpo };
    return res.status(200).json(corpo);
  } catch (e) {
    // Nunca devolve o endereço: só que falhou.
    return res.status(502).json({ erro: e instanceof Error && e.name === "AbortError" ? "a agenda demorou para responder" : "não consegui ler a agenda" });
  }
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
