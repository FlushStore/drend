// Avisos no iPhone.
// GET ?chave=1: a chave pública VAPID (o app precisa dela para se inscrever).
// GET com o CRON_SECRET (cron da Vercel, 7h30 de Brasília): manda o resumo da manhã.
// POST / DELETE com o login do Rapha: liga ou desliga os avisos neste aparelho.
import { timingSafeEqual } from "node:crypto";
import { banco, DONO, quemE } from "./_sessao.js";
import { diaEmBrasilia, resumoDaManha } from "./_resumo.js";
import { enviar, marcar, pushPronto } from "./_push.js";

function doCron(req) {
  const esperado = process.env.CRON_SECRET || "";
  const veio = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return esperado.length >= 16 && veio.length === esperado.length && timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}

async function ler(db, caminho) {
  const r = await fetch(`${db.url}/rest/v1/${caminho}`, { headers: db.cabecalhos });
  if (!r.ok) throw new Error(`banco respondeu ${r.status}`);
  return r.json();
}

async function manha(db, res) {
  const dia = diaEmBrasilia(Date.now());
  if (!(await marcar(db, `manha|${dia}`))) return res.status(200).json({ ja: true });
  const [agenda, estado] = await Promise.all([ler(db, "drend_agenda?select=eventos"), ler(db, "drend_estado?select=dados&limit=1")]);
  const eventos = agenda.flatMap((l) => (Array.isArray(l.eventos) ? l.eventos : []));
  const tarefas = Array.isArray(estado[0]?.dados?.tarefas) ? estado[0].dados.tarefas : [];
  const enviados = await enviar(db, resumoDaManha(eventos, tarefas));
  return res.status(200).json({ enviados });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.query.chave === "1") {
    return pushPronto() ? res.status(200).json({ chave: process.env.VAPID_PUBLIC_KEY }) : res.status(503).json({ erro: "avisos ainda não configurados" });
  }
  const db = banco();
  if (!db) return res.status(500).json({ erro: "banco não configurado" });
  if (req.method === "GET") {
    if (!doCron(req)) return res.status(401).json({ erro: "só o cron" });
    return manha(db, res);
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if ((await quemE(token)) !== DONO) return res.status(401).json({ erro: "entre na sua conta do DREND" });
  const corpo = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const endpoint = corpo?.inscricao?.endpoint ?? corpo?.endpoint;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) return res.status(400).json({ erro: "inscrição inválida" });

  if (req.method === "DELETE") {
    await fetch(`${db.url}/rest/v1/drend_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE", headers: db.cabecalhos });
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "use GET, POST ou DELETE" });
  const { keys } = corpo.inscricao;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return res.status(400).json({ erro: "inscrição inválida" });
  const r = await fetch(`${db.url}/rest/v1/drend_push?on_conflict=endpoint`, {
    method: "POST",
    headers: { ...db.cabecalhos, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint, inscricao: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } }),
  });
  if (!r.ok) return res.status(502).json({ erro: "não consegui guardar" });
  if (corpo.teste) await enviar(db, { titulo: "Avisos ligados", corpo: "É assim que o DREND vai te avisar.", url: "/" });
  return res.status(200).json({ ok: true });
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
