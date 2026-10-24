// Resumo diário da Flush guardado no servidor do DREND.
// POST: a tarefa agendada (de hora em hora) manda o resultado de scripts/flush-resumo.sql, lido
// da Flush só com SELECT, com o token dos agentes. GET: o app lê com o login do Rapha.
import { autorizado } from "./_token.js";
import { banco, DONO, quemE } from "./_sessao.js";

const dia = /^\d{4}-\d{2}-\d{2}$/;

/** Confere o resumo e devolve só os campos conhecidos, ou a mensagem do erro. */
export function validar(corpo) {
  const r = corpo?.resumo ?? corpo;
  if (!r || !Array.isArray(r.historico) || !r.historico.length || r.historico.length > 400) return { erro: "historico precisa ser uma lista de dias" };
  if (typeof r.lidoEm !== "string" || !Number.isFinite(Date.parse(r.lidoEm))) return { erro: "lidoEm inválido" };
  const historico = [];
  for (const d of r.historico) {
    const valor = Number(d?.valor);
    const lucro = Number(d?.lucro);
    const pedidos = Number(d?.pedidos);
    if (!dia.test(String(d?.dia)) || !Number.isFinite(valor) || !Number.isFinite(lucro) || !Number.isInteger(pedidos) || pedidos < 0) return { erro: `dia inválido: ${String(d?.dia)}` };
    historico.push({ dia: d.dia, valor, lucro, pedidos });
  }
  historico.sort((a, b) => a.dia.localeCompare(b.dia));
  return { resumo: { historico, lidoEm: new Date(r.lidoEm).toISOString() } };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const db = banco();
  if (!db) return res.status(500).json({ erro: "banco não configurado" });

  if (req.method === "POST") {
    if (!autorizado(req)) return res.status(401).json({ erro: "token inválido" });
    const corpo = typeof req.body === "string" ? safeJson(req.body) : req.body;
    const { resumo, erro } = validar(corpo);
    if (erro) return res.status(400).json({ erro });
    const r = await fetch(`${db.url}/rest/v1/drend_leitura?on_conflict=fonte`, {
      method: "POST",
      headers: { ...db.cabecalhos, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ fonte: "flush", dados: resumo, atualizado_em: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(r.status).json({ erro: "não consegui gravar" });
    return res.status(200).json({ fonte: "flush", dias: resumo.historico.length });
  }
  if (req.method !== "GET") return res.status(405).json({ erro: "use GET ou POST" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if ((await quemE(token)) !== DONO) return res.status(401).json({ erro: "entre na sua conta do DREND" });
  const r = await fetch(`${db.url}/rest/v1/drend_leitura?fonte=eq.flush&select=dados`, { headers: db.cabecalhos });
  if (!r.ok) return res.status(502).json({ erro: "não consegui ler" });
  const [linha] = await r.json();
  if (!linha) return res.status(404).json({ erro: "ainda sem leitura" });
  return res.status(200).json(linha.dados);
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
