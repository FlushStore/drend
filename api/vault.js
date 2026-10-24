// Vaults Obsidian do Rapha (Segundo Cérebro e Rapha OS Business), só leitura no DREND.
// POST: a tarefa agendada lê os repositórios dos vaults e manda as notas em lotes, com o
// token dos agentes; no fim de cada vault manda { fechar } e as notas que sumiram saem.
// GET: o app lê com o login do Rapha. Sem ?caminho, devolve o índice (sem o texto das notas);
// com ?caminho, a nota inteira; com ?q, as notas que têm o termo no texto.
import { VAULTS, validarNota } from "./_vault.js";
import { autorizado } from "./_token.js";

const DONO = "raphaelkhevenn@gmail.com";
const CAMPOS = "vault,caminho,titulo,pasta,tipo,status,projeto,papel,proxima,tags,resumo,modificado";

async function quemE(token) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !token) return null;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u.email === "string" ? u.email.toLowerCase() : null;
}

function banco() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && chave ? { url, cabecalhos: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" } } : null;
}

async function ler(db, caminho) {
  const r = await fetch(`${db.url}/rest/v1/${caminho}`, { headers: db.cabecalhos });
  if (!r.ok) throw new Error(`banco respondeu ${r.status}`);
  return r.json();
}

async function gravar(req, res, db) {
  // O PC do Rapha grava com um token só do vault (DREND_VAULT_TOKEN); as tarefas, com o dos agentes.
  if (!autorizado(req) && !autorizado(req, "DREND_VAULT_TOKEN")) return res.status(401).json({ erro: "token inválido" });
  const corpo = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const vault = corpo?.vault;
  if (!VAULTS[vault]) return res.status(400).json({ erro: "vault desconhecido" });
  const rodada = typeof corpo.rodada === "string" && !Number.isNaN(Date.parse(corpo.rodada)) ? new Date(corpo.rodada).toISOString() : null;
  if (!rodada) return res.status(400).json({ erro: "rodada precisa ser uma data ISO" });

  if (corpo.fechar) {
    // Fim da leitura: o que não foi regravado nesta rodada saiu do vault.
    const apagar = await fetch(`${db.url}/rest/v1/drend_vault?vault=eq.${vault}&atualizado_em=lt.${encodeURIComponent(rodada)}`, {
      method: "DELETE",
      headers: { ...db.cabecalhos, Prefer: "return=representation" },
    });
    if (!apagar.ok) return res.status(apagar.status).json({ erro: "não consegui limpar as notas antigas" });
    const saiu = (await apagar.json()).length;
    const contar = await fetch(`${db.url}/rest/v1/drend_vault?vault=eq.${vault}&select=caminho`, { method: "HEAD", headers: { ...db.cabecalhos, Prefer: "count=exact" } });
    const notas = Number(contar.headers.get("content-range")?.split("/")[1] ?? 0);
    const f = corpo.fechar;
    const linha = {
      vault,
      nome: VAULTS[vault],
      commit_sha: typeof f.commit === "string" && /^[0-9a-f]{7,40}$/.test(f.commit) ? f.commit : null,
      commit_em: typeof f.commitEm === "string" && !Number.isNaN(Date.parse(f.commitEm)) ? new Date(f.commitEm).toISOString() : null,
      notas,
      atualizado_em: new Date().toISOString(),
    };
    const r = await fetch(`${db.url}/rest/v1/drend_vault_leitura?on_conflict=vault`, {
      method: "POST",
      headers: { ...db.cabecalhos, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(linha),
    });
    if (!r.ok) return res.status(r.status).json({ erro: "não consegui registrar a leitura" });
    return res.status(200).json({ vault, notas, saiu });
  }

  if (!Array.isArray(corpo.notas) || corpo.notas.length > 100) return res.status(400).json({ erro: "notas precisa ser uma lista de até 100" });
  const notas = corpo.notas.map(validarNota);
  if (notas.some((n) => !n)) return res.status(400).json({ erro: "nota inválida no lote" });
  const r = await fetch(`${db.url}/rest/v1/drend_vault?on_conflict=vault,caminho`, {
    method: "POST",
    headers: { ...db.cabecalhos, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(notas.map((n) => ({ ...n, vault, atualizado_em: rodada }))),
  });
  if (!r.ok) return res.status(r.status).json({ erro: "não consegui gravar as notas" });
  return res.status(200).json({ vault, gravadas: notas.length });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const db = banco();
  if (!db) return res.status(500).json({ erro: "banco não configurado" });
  if (req.method === "POST") return gravar(req, res, db);
  if (req.method !== "GET") return res.status(405).json({ erro: "use GET ou POST" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if ((await quemE(token)) !== DONO) return res.status(401).json({ erro: "entre na sua conta do DREND" });

  try {
    const vault = String(req.query.vault || "");
    const caminho = String(req.query.caminho || "");
    if (caminho) {
      if (!VAULTS[vault]) return res.status(400).json({ erro: "vault desconhecido" });
      const [nota] = await ler(db, `drend_vault?vault=eq.${vault}&caminho=eq.${encodeURIComponent(caminho)}&select=${CAMPOS},corpo`);
      return nota ? res.status(200).json(nota) : res.status(404).json({ erro: "nota não encontrada" });
    }
    // Busca no texto: só letras, números e espaço (o termo entra num filtro do PostgREST).
    const q = String(req.query.q || "").normalize("NFC").replace(/[^\p{L}\p{N} ]+/gu, " ").trim().slice(0, 60);
    if (q) {
      const termo = encodeURIComponent(`*${q.replace(/\s+/g, "*")}*`);
      const notas = await ler(db, `drend_vault?or=(titulo.ilike.${termo},corpo.ilike.${termo})&select=${CAMPOS}&order=modificado.desc.nullslast&limit=40`);
      return res.status(200).json({ notas });
    }
    const [vaults, notas] = await Promise.all([
      ler(db, "drend_vault_leitura?select=vault,nome,commit_sha,commit_em,notas,atualizado_em&order=vault"),
      ler(db, `drend_vault?select=${CAMPOS}&order=modificado.desc.nullslast,titulo&limit=5000`),
    ]);
    if (!vaults.length) return res.status(503).json({ codigo: "sem-vault", erro: "o vault ainda não sincronizou" });
    return res.status(200).json({ vaults, notas });
  } catch {
    return res.status(502).json({ erro: "não consegui ler o vault" });
  }
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
