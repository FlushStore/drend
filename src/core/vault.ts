/**
 * Os vaults Obsidian do Rapha no DREND (só leitura). Funções puras sobre o que a /api/vault
 * devolve: projetos, ideias, decisões, busca e o markdown das notas em blocos para a tela.
 */
import { normalizar } from "./fala";

export interface NotaVault {
  vault: string;
  caminho: string;
  titulo: string;
  pasta: string;
  tipo: string | null;
  status: string | null;
  projeto: string | null;
  papel: string | null;
  proxima: string | null;
  tags: string[];
  resumo: string;
  modificado: string | null;
}
export interface NotaInteira extends NotaVault {
  corpo: string;
}
export interface LeituraVault {
  vault: string;
  nome: string;
  commit_sha: string | null;
  commit_em: string | null;
  notas: number;
  atualizado_em: string;
}

/** Os dois vaults têm muita nota em comum: fica a mais nova, e no empate a do Segundo Cérebro. */
export function unir(notas: readonly NotaVault[]): NotaVault[] {
  const melhor = new Map<string, NotaVault>();
  for (const n of notas) {
    const chave = n.caminho.toLowerCase();
    const atual = melhor.get(chave);
    if (!atual) {
      melhor.set(chave, n);
      continue;
    }
    const a = atual.modificado ?? "";
    const b = n.modificado ?? "";
    if (b > a || (b === a && n.vault === "segundo-cerebro")) melhor.set(chave, n);
  }
  return [...melhor.values()].sort((x, y) => (y.modificado ?? "").localeCompare(x.modificado ?? "") || x.titulo.localeCompare(y.titulo));
}

const STATUS: Record<string, string> = {
  active: "Ativo",
  blocked: "Pausado",
  planning: "Planejando",
  maintenance: "Manutenção",
  completed: "Concluído",
  archived: "Arquivado",
  proposed: "Proposto",
  draft: "Rascunho",
  pending: "Pendente",
  superseded: "Substituído",
  discarded: "Descartado",
};
export const statusPt = (s: string | null) => (s ? STATUS[s] ?? s : null);

/** "00 - Hub Black Store" → "Black Store"; "Flush PROJECT" → "Flush". */
export function nomeDoProjeto(n: NotaVault): string {
  if (n.projeto) return n.projeto;
  return n.titulo.replace(/^\d+\s*-\s*/, "").replace(/^Hub\s+/i, "").replace(/\s+PROJECT$/i, "").trim();
}

const ORDEM = ["active", "planning", "maintenance", "blocked", "proposed"];

/** As notas-hub de cada projeto: o que está andando primeiro, arquivados fora. */
export function projetosDoVault(notas: readonly NotaVault[]): NotaVault[] {
  const hubs = notas.filter((n) => n.papel === "hub" && !n.pasta.startsWith("99 - Archive") && n.status !== "archived");
  const porNome = new Map<string, NotaVault>();
  for (const h of hubs) {
    const k = normalizar(nomeDoProjeto(h));
    const atual = porNome.get(k);
    if (!atual || (h.modificado ?? "") > (atual.modificado ?? "")) porNome.set(k, h);
  }
  const peso = (n: NotaVault) => {
    const i = ORDEM.indexOf(n.status ?? "");
    return i === -1 ? ORDEM.length : i;
  };
  return [...porNome.values()].sort((a, b) => peso(a) - peso(b) || (b.modificado ?? "").localeCompare(a.modificado ?? ""));
}

export type Aba = "projetos" | "ideias" | "decisoes" | "recentes";

export function daAba(notas: readonly NotaVault[], aba: Aba): NotaVault[] {
  const vivas = notas.filter((n) => !n.pasta.startsWith("99 - Archive"));
  if (aba === "projetos") return projetosDoVault(notas);
  if (aba === "ideias") return vivas.filter((n) => n.pasta.startsWith("11 - Ideas") || n.tipo === "idea" || n.tipo === "capture");
  if (aba === "decisoes") return vivas.filter((n) => n.pasta.startsWith("05 - Decisions") || n.tipo === "decision");
  return vivas.slice(0, 40);
}

/** Busca no índice: título vale mais que etiqueta, que vale mais que resumo e pasta. */
export function buscar(notas: readonly NotaVault[], termo: string, limite = 40): NotaVault[] {
  const q = normalizar(termo).split(" ").filter((p) => p.length > 1);
  if (!q.length) return [];
  const pontos = (n: NotaVault) => {
    const titulo = normalizar(n.titulo);
    const tags = normalizar(n.tags.join(" ") + " " + (n.projeto ?? ""));
    const resto = normalizar(`${n.resumo} ${n.pasta}`);
    let p = 0;
    for (const w of q) {
      if (titulo.includes(w)) p += 3;
      else if (tags.includes(w)) p += 2;
      else if (resto.includes(w)) p += 1;
      else return 0;
    }
    return p - (n.pasta.startsWith("99 - Archive") ? 1 : 0);
  };
  return notas
    .map((n) => ({ n, p: pontos(n) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || (b.n.modificado ?? "").localeCompare(a.n.modificado ?? ""))
    .slice(0, limite)
    .map((x) => x.n);
}

/** O destino de um [[link]] do Obsidian: pelo nome do arquivo ou pelo título. */
export function acharNota(notas: readonly NotaVault[], alvo: string): NotaVault | null {
  const a = normalizar(alvo.split("#")[0].split("/").pop() ?? "");
  if (!a) return null;
  const arquivo = (n: NotaVault) => normalizar(n.caminho.split("/").pop()!.replace(/\.md$/, ""));
  return notas.find((n) => arquivo(n) === a) ?? notas.find((n) => normalizar(n.titulo) === a) ?? null;
}

/** "2026-10-24" → "24 out" (ou "24 out 2025" fora do ano corrente). */
export function quando(dia: string | null, agora = new Date()): string | null {
  if (!dia) return null;
  const d = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const mesmoAno = d.getFullYear() === agora.getFullYear();
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(mesmoAno ? {} : { year: "numeric" }) }).replace(".", "").replace(/ de /g, " ");
}

// ——— Markdown das notas em blocos (sem HTML cru: a tela monta cada pedaço) ———

export type Trecho =
  | { t: "texto"; v: string }
  | { t: "forte"; v: string }
  | { t: "codigo"; v: string }
  | { t: "nota"; alvo: string; v: string }
  | { t: "link"; href: string; v: string };

export type Bloco =
  | { t: "titulo"; nivel: number; trechos: Trecho[] }
  | { t: "paragrafo"; trechos: Trecho[] }
  | { t: "lista"; ordenada: boolean; itens: { trechos: Trecho[]; feito: boolean | null }[] }
  | { t: "aviso"; tipo: string; titulo: Trecho[]; linhas: Trecho[][] }
  | { t: "codigo"; v: string }
  | { t: "tabela"; linhas: Trecho[][][] }
  | { t: "linha" };

const INLINE = /(\[\[[^\]]+\]\]|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)>\]]+|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__)/g;

export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  let resto = 0;
  const limpar = (s: string) => s.replace(/(^|[^*])\*(?!\s)([^*]+)\*/g, "$1$2").replace(/==([^=]+)==/g, "$1");
  for (const m of linha.matchAll(INLINE)) {
    if (m.index! > resto) saida.push({ t: "texto", v: limpar(linha.slice(resto, m.index)) });
    const s = m[0];
    if (s.startsWith("[[")) {
      const [alvo, rotulo] = s.slice(2, -2).split("|");
      saida.push({ t: "nota", alvo: alvo.trim(), v: (rotulo ?? alvo.split("#")[0]).trim() });
    } else if (s.startsWith("[")) {
      const mm = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      saida.push({ t: "link", href: mm[2], v: mm[1] });
    } else if (s.startsWith("http")) saida.push({ t: "link", href: s, v: s.replace(/^https?:\/\//, "").replace(/\/$/, "") });
    else if (s.startsWith("`")) saida.push({ t: "codigo", v: s.slice(1, -1) });
    else saida.push({ t: "forte", v: s.slice(2, -2) });
    resto = m.index! + s.length;
  }
  if (resto < linha.length) saida.push({ t: "texto", v: limpar(linha.slice(resto)) });
  return saida.filter((x) => x.v !== "");
}

export function blocos(md: string): Bloco[] {
  const linhas = md.replace(/%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const saida: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) {
      const fim = linhas.findIndex((x, j) => j > i && /^```/.test(x));
      const ate = fim === -1 ? linhas.length : fim;
      const lingua = l.slice(3).trim();
      // Consultas do Dataview/Bases só fazem sentido dentro do Obsidian.
      if (!/^(dataview|dataviewjs|base|tasks|query)$/i.test(lingua)) saida.push({ t: "codigo", v: linhas.slice(i + 1, ate).join("\n") });
      i = ate + 1;
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { saida.push({ t: "titulo", nivel: h[1].length, trechos: trechos(h[2].trim()) }); i++; continue; }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(l)) { saida.push({ t: "linha" }); i++; continue; }
    if (/^>/.test(l)) {
      const grupo: string[] = [];
      while (i < linhas.length && /^>/.test(linhas[i])) grupo.push(linhas[i++].replace(/^>\s?/, ""));
      const c = grupo[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
      saida.push({
        t: "aviso",
        tipo: c ? c[1].toLowerCase() : "citacao",
        titulo: c ? trechos(c[2]) : [],
        linhas: (c ? grupo.slice(1) : grupo).filter((x) => x.trim()).map((x) => trechos(x.replace(/^\s*[-*+]\s+/, "• "))),
      });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const grupo: string[] = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) grupo.push(linhas[i++]);
      const celulas = grupo
        .filter((x) => !/^\s*\|[\s:|-]+\|\s*$/.test(x))
        .map((x) => x.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => trechos(c.trim())));
      saida.push({ t: "tabela", linhas: celulas });
      continue;
    }
    const item = l.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (item) {
      const ordenada = !!item[2];
      const itens: { trechos: Trecho[]; feito: boolean | null }[] = [];
      while (i < linhas.length) {
        const m = linhas[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
        if (!m) break;
        const tarefa = m[3].match(/^\[( |x|X)\]\s*(.*)$/);
        itens.push({ trechos: trechos(tarefa ? tarefa[2] : m[3]), feito: tarefa ? tarefa[1] !== " " : null });
        i++;
      }
      saida.push({ t: "lista", ordenada, itens });
      continue;
    }
    const grupo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|```|>|\s*\|.*\|\s*$|\s*(?:[-*+]|\d+[.)])\s+|\s*(?:---+|\*\*\*+)\s*$)/.test(linhas[i])) grupo.push(linhas[i++].trim());
    saida.push({ t: "paragrafo", trechos: trechos(grupo.join(" ")) });
  }
  return saida;
}

// ——— A conversa ———

/** "o que o vault diz sobre X": os títulos que batem, com a próxima ação quando é projeto. */
export function responderVault(notas: readonly NotaVault[] | null, termo: string, motivo?: string): string {
  if (!notas) return motivo ?? "Ainda não li o seu vault.";
  const achadas = buscar(notas, termo, 5);
  if (!achadas.length) return `Não achei nada sobre “${termo}” no vault. Abra o Vault e busque no texto das notas.`;
  const linhas = achadas.map((n) => `• ${n.titulo}${n.resumo ? `: ${n.resumo.length > 120 ? `${n.resumo.slice(0, 117).replace(/\s+\S*$/, "")}…` : n.resumo}` : ""}`);
  return `No vault, sobre “${termo}”:\n${linhas.join("\n")}`;
}

/** Os projetos do vault em uma linha cada: estado e próxima ação. */
export function responderProjetos(notas: readonly NotaVault[] | null, motivo?: string): string {
  if (!notas) return motivo ?? "Ainda não li o seu vault.";
  const ps = projetosDoVault(notas);
  if (!ps.length) return "O vault não tem nota-hub de projeto.";
  return `Projetos no vault:\n${ps.map((p) => `• ${nomeDoProjeto(p)} (${statusPt(p.status) ?? "sem status"})${p.proxima ? `: ${p.proxima}` : ""}`).join("\n")}`;
}
