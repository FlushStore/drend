#!/usr/bin/env node
// Registra um passo nas Missões do DREND, de qualquer sessão (Claude, Codex, terminal).
//   node scripts/missao.mjs item <missao> <chave> <feito|agora|depois> "<título>" ["texto"] [--ref https://...]
//   node scripts/missao.mjs nota|decisao|pergunta <missao> "<título>" ["texto"] [--ref https://...] [--chave pausa]
//   node scripts/missao.mjs ver [missao|todas]
// O token vem de DREND_AGENTE_TOKEN; no ambiente de nuvem do Claude o proxy já põe o cabeçalho.
import { spawnSync } from "node:child_process";

// Atrás de proxy (ambiente de nuvem), o fetch do Node só usa o proxy com NODE_USE_ENV_PROXY.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status ?? 1);
}
const URL_API = process.env.DREND_URL || "https://drend.vercel.app/api/missao";
const args = process.argv.slice(2);
const i = args.indexOf("--ref");
const ref = i >= 0 ? args.splice(i, 2)[1] : null;
const c = args.indexOf("--chave");
const chaveExtra = c >= 0 ? args.splice(c, 2)[1] : null;
const [tipo, ...resto] = args;
const cab = { "Content-Type": "application/json" };
if (process.env.DREND_AGENTE_TOKEN) cab.Authorization = `Bearer ${process.env.DREND_AGENTE_TOKEN}`;
const agente = process.env.DREND_AGENTE || "claude";

async function principal() {
  if (tipo === "ver") {
    const r = await fetch(`${URL_API}?missao=${resto[0] || "todas"}`, { headers: cab });
    const lista = await r.json();
    if (!r.ok) throw new Error(lista.erro || r.status);
    for (const e of lista.reverse()) console.log(`${e.em.slice(0, 16)} ${e.missao} ${e.tipo}${e.chave ? ` ${e.chave}` : ""}${e.fase ? ` [${e.fase}]` : ""} ${e.titulo}`);
    return;
  }
  let evento;
  if (tipo === "item") {
    const [missao, chave, fase, titulo, texto] = resto;
    evento = { missao, agente, tipo, chave, fase, titulo, texto, ref };
  } else if (["nota", "decisao", "pergunta"].includes(tipo)) {
    const [missao, titulo, texto] = resto;
    evento = { missao, agente, tipo, chave: chaveExtra, titulo, texto, ref };
  } else {
    console.error("uso: missao.mjs item|nota|decisao|pergunta|ver …");
    process.exit(2);
  }
  const r = await fetch(URL_API, { method: "POST", headers: cab, body: JSON.stringify(evento) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || r.status);
  console.log(`ok #${dados.id} ${dados.missao} ${dados.titulo}`);
}
principal().catch((e) => {
  console.error(`falhou: ${e.message}`);
  process.exit(1);
});
