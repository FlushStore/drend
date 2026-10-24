// Envia um vault Obsidian (clone do repositório no GitHub) para o DREND.
// Uso: node scripts/vault-enviar.mjs <vault> <pasta> [--se-mudou]   (vault: segundo-cerebro | rapha-os-business)
// O token vem de DREND_VAULT_TOKEN (PC do Rapha) ou DREND_AGENTE_TOKEN; no ambiente de nuvem do
// DREND o proxy já o injeta. DREND_URL troca o endereço (padrão: produção).
// --se-mudou: só envia quando alguma nota mudou desde o último envio (é o que roda no PC a cada
// poucos minutos, lendo o vault direto da pasta, sem depender do push para o GitHub).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { VAULTS, notaDoArquivo } from "../api/_vault.js";

const seMudou = process.argv.includes("--se-mudou");
const [vault, pasta] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!VAULTS[vault] || !pasta) {
  console.error(`uso: node scripts/vault-enviar.mjs <${Object.keys(VAULTS).join("|")}> <pasta>`);
  process.exit(2);
}
const base = (process.env.DREND_URL || "https://drend.vercel.app").replace(/\/$/, "");
const cabecalhos = { "Content-Type": "application/json" };
const token = process.env.DREND_VAULT_TOKEN || process.env.DREND_AGENTE_TOKEN;
if (token) cabecalhos.Authorization = `Bearer ${token}`;

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

const lista = (await arquivos(pasta)).sort();

// Impressão digital do vault (caminho, tamanho e hora de cada nota): igual à última = nada mudou.
const marca = path.join(os.homedir(), `.drend-vault-${vault}.json`);
let digital = null;
if (seMudou) {
  const h = createHash("sha256");
  for (const c of lista) {
    const s = await stat(path.join(pasta, c));
    h.update(`${c}\0${s.size}\0${s.mtimeMs}\n`);
  }
  digital = h.digest("hex");
  const antes = await readFile(marca, "utf8").then(JSON.parse, () => null);
  // Mesmo sem mudança local, reenvia se outra leitura (ex.: a do GitHub) gravou o vault depois.
  const remoto = antes?.digital === digital ? (await enviar({ vault, consultar: true })).em : null;
  if (antes?.digital === digital && remoto && remoto === antes.em) {
    console.log(`[vault] ${VAULTS[vault]}: nada mudou.`);
    process.exit(0);
  }
}

const rodada = new Date().toISOString();
const notas = [];
let fora = 0;
for (const c of lista) {
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
if (digital) await writeFile(marca, JSON.stringify({ digital, em: fim.em }));
console.log(`[vault] ${VAULTS[vault]}: ${enviadas} notas enviadas, ${fora} fora (modelos, anexos ou sensíveis), ${fim.saiu} removidas; ${fim.notas} no DREND.`);
