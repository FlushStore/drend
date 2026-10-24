// Envia um vault Obsidian (clone do repositório no GitHub) para o DREND.
// Uso: node scripts/vault-enviar.mjs <vault> <pasta>   (vault: segundo-cerebro | rapha-os-business)
// O token dos agentes vem de DREND_AGENTE_TOKEN; no ambiente de nuvem do DREND o proxy já o
// injeta nas chamadas a drend.vercel.app. DREND_URL troca o endereço (padrão: produção).
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { VAULTS, notaDoArquivo } from "../api/_vault.js";

const [vault, pasta] = process.argv.slice(2);
if (!VAULTS[vault] || !pasta) {
  console.error(`uso: node scripts/vault-enviar.mjs <${Object.keys(VAULTS).join("|")}> <pasta>`);
  process.exit(2);
}
const base = (process.env.DREND_URL || "https://drend.vercel.app").replace(/\/$/, "");
const cabecalhos = { "Content-Type": "application/json" };
if (process.env.DREND_AGENTE_TOKEN) cabecalhos.Authorization = `Bearer ${process.env.DREND_AGENTE_TOKEN}`;

async function arquivos(dir, rel = "") {
  const saida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) saida.push(...(await arquivos(path.join(dir, e.name), r)));
    else if (e.name.endsWith(".md")) saida.push(r);
  }
  return saida;
}

async function enviar(corpo) {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(`${base}/api/vault`, { method: "POST", headers: cabecalhos, body: JSON.stringify(corpo) });
    if (r.ok) return r.json();
    const erro = await r.text();
    if (tentativa >= 3 || r.status < 500) throw new Error(`POST /api/vault ${r.status}: ${erro.slice(0, 200)}`);
    await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
  }
}

function git(...args) {
  try {
    return execFileSync("git", ["-C", pasta, ...args], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const rodada = new Date().toISOString();
const notas = [];
let fora = 0;
for (const c of (await arquivos(pasta)).sort()) {
  const n = notaDoArquivo(c, await readFile(path.join(pasta, c), "utf8"));
  if (n) notas.push(n);
  else fora++;
}

// Lotes de até ~1,5 MB e 60 notas (o limite da Vercel é 4,5 MB por pedido).
let lote = [];
let tamanho = 0;
let enviadas = 0;
for (const n of notas) {
  const t = JSON.stringify(n).length;
  if (lote.length && (lote.length >= 60 || tamanho + t > 1_500_000)) {
    enviadas += (await enviar({ vault, rodada, notas: lote })).gravadas;
    lote = [];
    tamanho = 0;
  }
  lote.push(n);
  tamanho += t;
}
if (lote.length) enviadas += (await enviar({ vault, rodada, notas: lote })).gravadas;

const fim = await enviar({ vault, rodada, fechar: { commit: git("rev-parse", "HEAD"), commitEm: git("log", "-1", "--format=%cI") } });
console.log(`[vault] ${VAULTS[vault]}: ${enviadas} notas enviadas, ${fora} fora (modelos, anexos ou sensíveis), ${fim.saiu} removidas; ${fim.notas} no DREND.`);
