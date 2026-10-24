import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Bloco } from "@/design-system/Bloco";
import { Botao } from "@/design-system/Botao";
import { BotaoCirculo } from "@/design-system/BotaoCirculo";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { CampoDeBusca } from "@/design-system/CampoDeBusca";
import { FiltroDeLista } from "@/design-system/FiltroDeLista";
import { Painel } from "@/design-system/Painel";
import {
  acharNota, blocos, buscar, daAba, nomeDoProjeto, quando, statusPt,
  type Aba, type Bloco as BlocoMd, type NotaInteira, type NotaVault, type Trecho,
} from "@/core/vault";
import { abrirNota, atualizarVault, buscarNoTexto, motivoSemVault, notasDo, useVault } from "@/fontes/vault";

const ABAS: ReadonlyArray<{ valor: Aba; rotulo: string }> = [
  { valor: "projetos", rotulo: "Projetos" },
  { valor: "ideias", rotulo: "Ideias" },
  { valor: "decisoes", rotulo: "Decisões" },
  { valor: "recentes", rotulo: "Recentes" },
];

const TOM: Record<string, string> = { active: "acento", planning: "acento", maintenance: "ok", blocked: "alerta" };
/** "02 - Projects/Flush/Docs" → "Projects · Flush" */
const pastaCurta = (p: string) => p.split("/").slice(0, 2).map((x) => x.replace(/^\d+\s*-\s*/, "")).join(" · ");

function Linha({ n, i, aoAbrir }: { n: NotaVault; i: number; aoAbrir: (n: NotaVault) => void }) {
  const data = quando(n.modificado);
  return (
    <li style={{ "--i": i } as CSSProperties}>
      <button type="button" className="dr-cartao cos-bloco dr-cartao-botao" onClick={() => aoAbrir(n)}>
        <small className="dr-lista-tipo">{pastaCurta(n.pasta) || "Raiz"}{data ? ` · ${data}` : ""}</small>
        <strong className="dr-cartao-titulo">{n.titulo}</strong>
        {n.resumo && <span className="dr-cartao-corpo dr-vault-resumo">{n.resumo}</span>}
      </button>
    </li>
  );
}

function Projeto({ n, aoAbrir }: { n: NotaVault; aoAbrir: (n: NotaVault) => void }) {
  return (
    <Bloco className="dr-proj dr-vault-proj" aria-label={nomeDoProjeto(n)}>
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">{nomeDoProjeto(n)}</h2>
        <span className="dr-estado"><i className="dr-ponto" data-tom={TOM[n.status ?? ""]} aria-hidden="true" />{statusPt(n.status) ?? "Sem status"}</span>
      </div>
      {n.proxima ? (
        <p className="dr-proj-linha"><span className="dr-vault-rotulo">Próximo passo</span>{n.proxima}</p>
      ) : n.resumo ? (
        <p className="dr-proj-linha">{n.resumo}</p>
      ) : null}
      <Botao variante="fantasma" compacto onClick={() => aoAbrir(n)}>Abrir a nota</Botao>
    </Bloco>
  );
}

function Trechos({ ts, notas, aoAbrir }: { ts: Trecho[]; notas: readonly NotaVault[]; aoAbrir: (n: NotaVault) => void }) {
  return (
    <>
      {ts.map((t, i) => {
        if (t.t === "forte") return <strong key={i}>{t.v}</strong>;
        if (t.t === "codigo") return <code key={i}>{t.v}</code>;
        if (t.t === "link") return <a key={i} href={t.href} target="_blank" rel="noreferrer">{t.v}</a>;
        if (t.t === "nota") {
          const alvo = acharNota(notas, t.alvo);
          return alvo
            ? <button key={i} type="button" className="dr-vault-wiki" onClick={() => aoAbrir(alvo)}>{t.v}</button>
            : <span key={i} className="dr-vault-wiki" data-sem-nota="">{t.v}</span>;
        }
        return <span key={i}>{t.v}</span>;
      })}
    </>
  );
}

function Markdown({ md, titulo, notas, aoAbrir }: { md: string; titulo: string; notas: readonly NotaVault[]; aoAbrir: (n: NotaVault) => void }) {
  // O # do começo costuma repetir o título que o painel já mostra.
  const lista = useMemo(() => blocos(md).filter((b) => !(b.t === "titulo" && b.nivel === 1 && b.trechos.map((t) => t.v).join("") === titulo)), [md, titulo]);
  const T = (ts: Trecho[]) => <Trechos ts={ts} notas={notas} aoAbrir={aoAbrir} />;
  const um = (b: BlocoMd, i: number): ReactNode => {
    switch (b.t) {
      case "titulo": {
        const H = (`h${Math.min(6, b.nivel + 2)}`) as "h3";
        return <H key={i} data-nivel={b.nivel}>{T(b.trechos)}</H>;
      }
      case "paragrafo": return <p key={i}>{T(b.trechos)}</p>;
      case "lista": {
        const L = b.ordenada ? "ol" : "ul";
        return (
          <L key={i}>
            {b.itens.map((it, j) => <li key={j} data-feito={it.feito ?? undefined}>{it.feito !== null && <i className="dr-vault-caixa" aria-label={it.feito ? "Feito" : "A fazer"} />}{T(it.trechos)}</li>)}
          </L>
        );
      }
      case "aviso":
        return (
          <aside key={i} className="dr-vault-aviso" data-tipo={b.tipo}>
            {b.titulo.length > 0 && <strong>{T(b.titulo)}</strong>}
            {b.linhas.map((l, j) => <p key={j}>{T(l)}</p>)}
          </aside>
        );
      case "codigo": return <pre key={i}><code>{b.v}</code></pre>;
      case "tabela":
        return (
          <div key={i} className="dr-vault-tabela">
            <table>
              <tbody>{b.linhas.map((l, j) => <tr key={j}>{l.map((c, k) => (j === 0 ? <th key={k}>{T(c)}</th> : <td key={k}>{T(c)}</td>))}</tr>)}</tbody>
            </table>
          </div>
        );
      case "linha": return <hr key={i} />;
    }
  };
  return <div className="dr-vault-md">{lista.map(um)}</div>;
}

/** O vault Obsidian do Rapha, só leitura: projetos, ideias, decisões e busca em tudo. */
export function Vault() {
  const estado = useVault();
  const notas = notasDo(estado);
  const [busca, setBusca] = useSearchParams();
  const [aba, setAba] = useState<Aba>("projetos");
  const [termo, setTermo] = useState(busca.get("q") ?? "");
  const [aberta, setAberta] = useState<NotaVault | null>(null);
  const [inteira, setInteira] = useState<NotaInteira | { erro: string } | null>(null);
  const [noTexto, setNoTexto] = useState<{ termo: string; notas: NotaVault[] | null; erro?: string } | null>(null);

  // Vindo da conversa com ?q=: já abre com a busca.
  useEffect(() => {
    if (busca.get("q")) setBusca({}, { replace: true });
  }, [busca, setBusca]);

  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    setInteira(null);
    abrirNota(aberta).then(
      (n) => vivo && setInteira(n),
      (e) => vivo && setInteira({ erro: e instanceof Error ? e.message : "não abriu" }),
    );
    return () => { vivo = false; };
  }, [aberta]);

  const t = termo.trim();
  const achadas = useMemo(() => (notas && t ? buscar(notas, t) : null), [notas, t]);
  const daVez = useMemo(() => (notas ? daAba(notas, aba) : []), [notas, aba]);
  const contas = useMemo(() => (notas ? Object.fromEntries(ABAS.map((a) => [a.valor, daAba(notas, a.valor).length])) : {}), [notas]);

  function procurarNoTexto() {
    const q = t;
    setNoTexto({ termo: q, notas: null });
    buscarNoTexto(q).then(
      (ns) => setNoTexto({ termo: q, notas: ns }),
      (e) => setNoTexto({ termo: q, notas: [], erro: e instanceof Error ? e.message : "falhou" }),
    );
  }

  const lido = estado.fase === "ok" || estado.fase === "erro" ? estado.vaults : [];
  const commit = lido.map((v) => v.commit_em).filter(Boolean).sort().pop() ?? null;

  if (!notas) {
    return (
      <>
        <CabecalhoDeTela titulo="Vault" />
        {estado.fase !== "carregando" && <p className="dr-vazio">{motivoSemVault(estado)}</p>}
      </>
    );
  }

  const extras = noTexto && noTexto.termo === t && noTexto.notas ? noTexto.notas.filter((n) => !achadas?.some((a) => a.caminho === n.caminho)) : [];

  return (
    <>
      <CabecalhoDeTela titulo="Vault">
        <div className="dr-mural-acoes">
          {commit && <span className="dr-estado dr-vault-quando">{estado.fase === "erro" ? "Última leitura:" : "Atualizado"} {new Date(commit).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "")}</span>}
          <BotaoCirculo rotulo="Ler de novo" onClick={() => void atualizarVault(true)}><RefreshCw size={17} strokeWidth={1.75} /></BotaoCirculo>
        </div>
      </CabecalhoDeTela>

      <CampoDeBusca className="dr-mural-busca" valor={termo} aoMudar={setTermo} rotulo="Buscar no vault" />

      {achadas ? (
        <>
          {achadas.length === 0 && extras.length === 0 && <p className="dr-vazio dr-mural-nada">Nada no título ou no resumo com “{t}”.</p>}
          {(achadas.length > 0 || extras.length > 0) && (
            <ul className="dr-mural-lista" aria-label="Resultados da busca">
              {[...achadas, ...extras].map((n, i) => <Linha key={`${n.vault}/${n.caminho}`} n={n} i={i} aoAbrir={setAberta} />)}
            </ul>
          )}
          {t.length > 1 && (!noTexto || noTexto.termo !== t) && (
            <Botao variante="secundaria" compacto className="dr-vault-mais" onClick={procurarNoTexto}>Buscar no texto das notas</Botao>
          )}
          {noTexto?.termo === t && !noTexto.notas && <p className="dr-vazio">Procurando no texto…</p>}
          {noTexto?.termo === t && noTexto.erro && <p className="dr-vazio">Não consegui buscar no texto ({noTexto.erro}).</p>}
          {noTexto?.termo === t && noTexto.notas && !noTexto.erro && extras.length === 0 && <p className="dr-vazio">O texto das notas não tem mais nada com “{t}”.</p>}
        </>
      ) : (
        <>
          <FiltroDeLista className="dr-mural-filtros dr-vault-filtros" rotulo="Partes do vault" valor={aba} aoMudar={setAba} opcoes={ABAS.map((a) => ({ ...a, conta: contas[a.valor] }))} />
          {daVez.length === 0 ? (
            <p className="dr-vazio">Nada aqui no vault ainda.</p>
          ) : aba === "projetos" ? (
            <div className="dr-negocios">{daVez.map((n) => <Projeto key={`${n.vault}/${n.caminho}`} n={n} aoAbrir={setAberta} />)}</div>
          ) : (
            <ul className="dr-mural-lista" aria-label={ABAS.find((a) => a.valor === aba)?.rotulo}>
              {daVez.map((n, i) => <Linha key={`${n.vault}/${n.caminho}`} n={n} i={i} aoAbrir={setAberta} />)}
            </ul>
          )}
        </>
      )}

      <Painel aberto={!!aberta} aoFechar={() => setAberta(null)} titulo={aberta?.titulo ?? "Nota"} chave={aberta ? `${aberta.vault}/${aberta.caminho}` : undefined}>
        {aberta && (
          <article className="dr-vault-nota">
            <p className="dr-vault-meta">
              {[lido.find((v) => v.vault === aberta.vault)?.nome, pastaCurta(aberta.pasta), quando(aberta.modificado), statusPt(aberta.status)].filter(Boolean).join(" · ")}
            </p>
            {aberta.proxima && <p className="dr-vault-proxima"><span className="dr-vault-rotulo">Próximo passo</span>{aberta.proxima}</p>}
            {!inteira ? (
              <p className="dr-vazio">Abrindo…</p>
            ) : "erro" in inteira ? (
              <p className="dr-vazio">Não consegui abrir a nota ({inteira.erro}).</p>
            ) : (
              <Markdown md={inteira.corpo} titulo={aberta.titulo} notas={notas} aoAbrir={setAberta} />
            )}
          </article>
        )}
      </Painel>
    </>
  );
}
