// Agenda do Rapha (Google Agenda, só leitura). O endereço secreto do iCal fica só aqui, no
// servidor (AGENDA_ICS_URL; vários separados por vírgula). Só responde para a sessão do
// Rapha no DREND: o app manda o token do login e a função confere o e-mail no Supabase.
import { compromissos } from "./_ics.js";

const DONO = "raphaelkhevenn@gmail.com";
const DIA = 864e5;
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

/** O e-mail da sessão, conferido no Supabase do DREND. null se o token não vale. */
async function quemE(token) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !token) return null;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u.email === "string" ? u.email.toLowerCase() : null;
}

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ erro: "use GET" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if ((await quemE(token)) !== DONO) return res.status(401).json({ erro: "entre na sua conta do DREND" });

  const fontes = String(process.env.AGENDA_ICS_URL || "").split(/[\s,]+/).filter((u) => /^https:\/\//.test(u));
  if (!fontes.length) return res.status(503).json({ codigo: "sem-agenda", erro: "agenda ainda não ligada" });

  const agora = Date.now();
  if (cache && agora - cache.em < CACHE_MS && req.query.forcar !== "1") return res.status(200).json(cache.corpo);
  try {
    const de = agora - DIA / 2;
    const ate = agora + 15 * DIA;
    const listas = await Promise.all(fontes.map(async (u) => compromissos(await baixar(u), de, ate)));
    const eventos = listas.flat().sort((a, b) => a.inicio.localeCompare(b.inicio));
    const corpo = { eventos, atualizadoEm: new Date(agora).toISOString() };
    cache = { em: agora, corpo };
    return res.status(200).json(corpo);
  } catch (e) {
    // Nunca devolve o endereço: só que falhou.
    return res.status(502).json({ erro: e instanceof Error && e.name === "AbortError" ? "a agenda demorou para responder" : "não consegui ler a agenda" });
  }
}
