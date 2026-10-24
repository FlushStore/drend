// Central de IAs: a porta por onde Claude, ChatGPT e Codex registram passos da missão.
// POST grava um evento; GET devolve os últimos. Exige o token DREND_AGENTE_TOKEN
// (Authorization: Bearer ...). A chave de serviço do Supabase só existe aqui, no servidor.
// Os PRs do repositório também entram sozinhos, pelo GitHub Actions (ver _github.js).
import { autorizado } from "./_token.js";
import { conferirOidc, eventoDePr } from "./_github.js";

const AGENTES = new Set(["claude", "chatgpt", "codex", "drend", "rapha"]);
const TIPOS = new Set(["item", "nota", "decisao", "pergunta"]);
const FASES = new Set(["feito", "agora", "depois"]);

const ANO = 365 * 864e5;

/** Confere o evento e devolve só os campos conhecidos, ou a mensagem do erro. */
export function validar(corpo, agora = Date.now()) {
  if (!corpo || typeof corpo !== "object") return { erro: "corpo JSON obrigatório" };
  const e = {
    missao: corpo.missao ?? "drend",
    agente: corpo.agente,
    tipo: corpo.tipo,
    chave: corpo.chave ?? null,
    titulo: typeof corpo.titulo === "string" ? corpo.titulo.trim() : "",
    texto: typeof corpo.texto === "string" && corpo.texto.trim() ? corpo.texto.trim() : null,
    fase: corpo.fase ?? null,
    ref: corpo.ref ?? null,
  };
  // Histórico de verdade: quem registra um passo antigo (um PR mergeado ontem) diz quando foi.
  if (corpo.em !== undefined && corpo.em !== null) {
    const t = typeof corpo.em === "string" && /^\d{4}-\d{2}-\d{2}T/.test(corpo.em) ? Date.parse(corpo.em) : NaN;
    if (!Number.isFinite(t) || t > agora + 5 * 60000 || t < agora - ANO) return { erro: "em precisa ser uma data ISO do último ano" };
    e.em = new Date(t).toISOString();
  }
  if (!/^[a-z0-9-]{1,40}$/.test(e.missao)) return { erro: "missao inválida" };
  if (!AGENTES.has(e.agente)) return { erro: "agente inválido" };
  if (!TIPOS.has(e.tipo)) return { erro: "tipo inválido" };
  if (!e.titulo || e.titulo.length > 200) return { erro: "titulo entre 1 e 200 caracteres" };
  if (e.texto && e.texto.length > 2000) return { erro: "texto até 2000 caracteres" };
  if (e.chave !== null && !/^[a-z0-9-]{1,60}$/.test(e.chave)) return { erro: "chave inválida" };
  if (e.fase !== null && !FASES.has(e.fase)) return { erro: "fase inválida" };
  if (e.ref !== null && !(typeof e.ref === "string" && /^https:\/\//.test(e.ref) && e.ref.length <= 500)) return { erro: "ref precisa ser um link https" };
  if (e.tipo === "item" && (!e.chave || !e.fase)) return { erro: "item precisa de chave e fase" };
  return { evento: e };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const agente = autorizado(req);
  const github = agente ? null : await conferirOidc(String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!agente && !github) return res.status(401).json({ erro: "token inválido" });
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) return res.status(500).json({ erro: "banco não configurado" });
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };

  if (req.method === "GET") {
    if (!agente) return res.status(403).json({ erro: "o GitHub só grava" });
    // ?missao=todas devolve o retrato de todos os projetos (o que uma IA lê antes de começar).
    const pedida = String(req.query.missao || "");
    const filtro = pedida === "todas" ? "" : `missao=eq.${/^[a-z0-9-]{1,40}$/.test(pedida) ? pedida : "drend"}&`;
    const r = await fetch(`${url}/rest/v1/drend_missao?${filtro}order=em.desc&limit=${filtro ? 200 : 1000}`, { headers: cabecalhos });
    return res.status(r.status).json(await r.json());
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "use GET ou POST" });

  const corpo = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const { evento, erro } = validar(corpo);
  if (erro) return res.status(400).json({ erro });
  if (!agente && !eventoDePr(evento)) return res.status(403).json({ erro: "o GitHub só grava o item do próprio PR" });
  const r = await fetch(`${url}/rest/v1/drend_missao`, { method: "POST", headers: { ...cabecalhos, Prefer: "return=representation" }, body: JSON.stringify(evento) });
  const dados = await r.json();
  return res.status(r.ok ? 201 : r.status).json(r.ok ? dados[0] : { erro: dados.message ?? "falhou" });
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
