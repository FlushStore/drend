// Leitura das notas dos vaults Obsidian do Rapha. Usado pelo script que envia o vault
// (scripts/vault-enviar.mjs) e pela /api/vault, que confere o que chega.
// Nota "sensitive" no vault não sai do vault. Valores com cara de segredo viram [oculto].

export const VAULTS = {
  "segundo-cerebro": "Segundo Cérebro",
  "rapha-os-business": "Rapha OS Business",
};

/** Pastas que não são notas do Rapha: modelos, anexos, configuração. */
const FORA = /(^|\/)(\.git|\.obsidian|\.trash|\.claude|node_modules|98 - Templates|13 - Assets|scripts)(\/|$)/;

export const MAX_CORPO = 40000;

/** Só os campos que o DREND usa, de um frontmatter YAML simples (chave: valor e listas). */
export function lerFrontmatter(texto) {
  const t = texto.replace(/^﻿/, "");
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { dados: {}, corpo: t };
  const dados = {};
  let lista = null;
  for (const linha of m[1].split(/\r?\n/)) {
    const item = linha.match(/^\s+-\s+(.*)$/);
    if (item && lista) {
      dados[lista].push(limpar(item[1]));
      continue;
    }
    const kv = linha.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, chave, bruto] = kv;
    const valor = bruto.replace(/\s+#.*$/, "").trim();
    lista = null;
    if (!valor) {
      dados[chave] = [];
      lista = chave;
    } else if (/^\[.*\]$/.test(valor)) {
      dados[chave] = valor.slice(1, -1).split(",").map(limpar).filter(Boolean);
    } else {
      dados[chave] = limpar(valor);
    }
  }
  return { dados, corpo: t.slice(m[0].length) };
}

function limpar(v) {
  return String(v).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

const texto = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const data = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Tira o que parece credencial: chaves de API, tokens, JWT, senhas escritas. */
export function tirarSegredos(t) {
  return t
    .replace(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[oculto]")
    .replace(/\b(?:sk|pk|rk)-(?:ant-|proj-|live-|test-)?[A-Za-z0-9_-]{16,}/g, "[oculto]")
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[oculto]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/g, "[oculto]")
    .replace(/\bAKIA[0-9A-Z]{16}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[oculto]")
    .replace(/\b(senha|password|passwd|secret|token|api[_ -]?key|chave secreta)(\s*[:=]\s*)(["'`]?)[^\s"'`]{6,}\3/gi, "$1$2[oculto]");
}

/** A primeira frase de verdade da nota (sem título, aviso, lista ou tabela), sem markdown. */
export function resumoDe(corpo) {
  for (const bloco of corpo.split(/\r?\n\s*\r?\n/)) {
    const b = bloco.trim();
    if (!b || /^(#|>|\||[-*+] |\d+\. |```|<|!\[|---|%%)/.test(b)) continue;
    const s = semMarkdown(b);
    if (s.length < 12) continue;
    return s.length > 220 ? `${s.slice(0, 217).replace(/\s+\S*$/, "")}…` : s;
  }
  return "";
}

export function semMarkdown(t) {
  return t
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]|#]+)(?:#[^\]]*)?\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Uma nota pronta para o DREND, ou null quando não deve sair do vault. */
export function notaDoArquivo(caminho, conteudo) {
  const c = caminho.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!c.endsWith(".md") || FORA.test(c)) return null;
  const { dados, corpo } = lerFrontmatter(conteudo);
  if (String(dados.sensitivity || "").toLowerCase() === "sensitive") return null;
  const partes = c.split("/");
  const nome = partes[partes.length - 1].replace(/\.md$/, "");
  const h1 = corpo.match(/^#\s+(.+)$/m)?.[1];
  const tags = (Array.isArray(dados.tags) ? dados.tags : typeof dados.tags === "string" ? dados.tags.split(/[\s,]+/) : [])
    .map((x) => String(x).replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
  const limpo = tirarSegredos(corpo.trim());
  return {
    caminho: c,
    titulo: (texto(dados.title) ?? texto(h1 && semMarkdown(h1)) ?? nome).slice(0, 200),
    pasta: partes.slice(0, -1).join("/"),
    tipo: texto(dados.type, 40),
    status: texto(dados.status, 40),
    projeto: texto(dados.project, 80),
    papel: texto(dados.project_role, 40),
    proxima: texto(tirarSegredos(String(dados.next_action ?? "")), 300),
    tags,
    resumo: resumoDe(limpo),
    corpo: limpo.length > MAX_CORPO ? `${limpo.slice(0, MAX_CORPO)}\n\n…(nota cortada no DREND)` : limpo,
    modificado: data(dados.updated) ?? data(dados.last_verified) ?? data(dados.created) ?? data(nome.match(/^\d{4}-\d{2}-\d{2}/)?.[0]),
  };
}

/** Confere uma nota que chegou pelo POST e devolve só os campos conhecidos. */
export function validarNota(n) {
  if (!n || typeof n !== "object") return null;
  if (typeof n.caminho !== "string" || !n.caminho.endsWith(".md") || n.caminho.length > 400 || n.caminho.includes("..")) return null;
  if (typeof n.titulo !== "string" || !n.titulo.trim()) return null;
  const opc = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    caminho: n.caminho,
    titulo: n.titulo.trim().slice(0, 200),
    pasta: typeof n.pasta === "string" ? n.pasta.slice(0, 400) : "",
    tipo: opc(n.tipo, 40),
    status: opc(n.status, 40),
    projeto: opc(n.projeto, 80),
    papel: opc(n.papel, 40),
    proxima: opc(n.proxima, 300),
    tags: Array.isArray(n.tags) ? n.tags.filter((t) => typeof t === "string").map((t) => t.slice(0, 60)).slice(0, 20) : [],
    resumo: typeof n.resumo === "string" ? n.resumo.slice(0, 300) : "",
    corpo: typeof n.corpo === "string" ? tirarSegredos(n.corpo).slice(0, MAX_CORPO + 40) : "",
    modificado: data(n.modificado),
  };
}
