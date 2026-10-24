import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Bloco, BlocoHeroi } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { NOME_AGENTE, estaParado, haQuanto, itemParado, nomeDaMissao, ondeParou, projetos, type ItemMissao, type Projeto } from "@/core/missao";
import { useMissoes } from "@/fontes/missoes";
import { Cerebro } from "@/cerebro/Cerebro";

/** Relógio de 30 s: o "há 2 min" anda sozinho com a tela aberta. */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

function Item({ item, novo, agora }: { item: ItemMissao; novo: boolean; agora: Date }) {
  const atrasado = itemParado(item, agora);
  const corpo = (
    <>
      <span className="dr-mi-titulo">{item.titulo}</span>
      {item.texto && <small className="dr-mi-texto">{item.texto}</small>}
      {atrasado && <small className="dr-mi-parado">Sem passo {haQuanto(item.em, agora)}</small>}
    </>
  );
  return (
    <li className="dr-mi" data-fase={item.fase} data-novo={novo || undefined} data-parado={atrasado || undefined}>
      <i className="dr-mi-marca" aria-hidden="true" />
      {item.ref ? (
        <a className="dr-mi-corpo" href={item.ref} target="_blank" rel="noreferrer">
          {corpo}
          <ArrowUpRight size={14} aria-hidden="true" className="dr-mi-link" />
        </a>
      ) : (
        <span className="dr-mi-corpo">{corpo}</span>
      )}
    </li>
  );
}

function CartaoProjeto({ p, agora, novo }: { p: Projeto; agora: Date; novo: number | null }) {
  const [aberto, setAberto] = useState(false);
  const parado = estaParado(p);
  const estado = !p.ultimo ? "Sem passos ainda" : p.pausado ? "Pausado" : parado ? `Parado há ${p.parado} dias` : `Mexido ${haQuanto(p.ultimo.em, agora)}`;
  const novoAqui = (i: ItemMissao) => novo !== null && p.ultimo?.id === novo && p.ultimo.chave === i.chave;
  return (
    <Bloco className="dr-proj dr-missao" aria-label={p.nome} data-pausado={p.pausado || undefined}>
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">{p.nome}</h2>
        <span className="dr-estado"><i className="dr-ponto" data-tom={parado ? "alerta" : p.itens.agora.length ? "acento" : undefined} aria-hidden="true" />{estado}</span>
      </div>
      {p.itens.agora.length > 0 ? (
        <ul className="dr-mi-lista" aria-label="Em andamento">
          {p.itens.agora.map((i) => <Item key={i.chave} item={i} novo={novoAqui(i)} agora={agora} />)}
        </ul>
      ) : (
        <p className="dr-proj-linha">{p.ultimo ? p.ultimo.titulo : "Nada em andamento."}</p>
      )}
      {(p.itens.feito.length > 0 || p.itens.depois.length > 0) && (
        <button type="button" className="dr-mi-mais" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          {[p.itens.feito.length && `${p.itens.feito.length} feito${p.itens.feito.length > 1 ? "s" : ""}`, p.itens.depois.length && `${p.itens.depois.length} depois`].filter(Boolean).join(" · ")}
        </button>
      )}
      {aberto && (
        <div className="dr-mi-resto">
          {p.itens.depois.length > 0 && (
            <ul className="dr-mi-lista" aria-label="Depois">{p.itens.depois.map((i) => <Item key={i.chave} item={i} novo={false} agora={agora} />)}</ul>
          )}
          {p.itens.feito.length > 0 && (
            <ul className="dr-mi-lista" aria-label="Feito">{p.itens.feito.map((i) => <Item key={i.chave} item={i} novo={false} agora={agora} />)}</ul>
          )}
        </div>
      )}
    </Bloco>
  );
}

/** Todos os projetos numa tela, ao vivo: o que está andando, o que parou, quem mexeu. */
export function Missoes() {
  const m = useMissoes();
  const agora = useAgora();

  if (m.fase !== "ok") {
    const texto =
      m.fase === "carregando" ? "Carregando…"
      : m.fase === "fora" || m.fase === "sem-banco" ? "Entre na sua conta do DREND para ver as missões ao vivo."
      : "A Central de IAs liga depois do próximo merge.";
    return (
      <>
        <CabecalhoDeTela titulo="Missões" />
        <p className="dr-vazio">{texto}</p>
      </>
    );
  }

  const lista = projetos(m.eventos, agora);
  const onde = ondeParou(lista);
  const parados = lista.filter(estaParado);
  const feed = [...m.eventos].sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id).slice(0, 12);
  return (
    <>
      <CabecalhoDeTela titulo="Missões">
        <span className="dr-ao-vivo" data-on={m.aoVivo || undefined}><i aria-hidden="true" />{m.aoVivo ? "Ao vivo" : "Conectando"}</span>
      </CabecalhoDeTela>
      <Cerebro tamanho="p" atividade={m.novo ?? 0} />
      {onde && (
        <BlocoHeroi className="dr-onde" aria-label="Onde você parou">
          <span className="dr-rotulo">Onde você parou · {haQuanto(onde.projeto.ultimo!.em, agora)}</span>
          <p className="dr-onde-proj">{onde.projeto.nome}</p>
          <p className="dr-onde-item">{onde.item ? onde.item.titulo : onde.projeto.ultimo!.titulo}</p>
          {parados.length > 0 && (
            <p className="dr-onde-parados">
              <i className="dr-ponto" data-tom="alerta" aria-hidden="true" />
              {parados.map((p) => `${p.nome} parado há ${p.parado} dias`).join(" · ")}
            </p>
          )}
        </BlocoHeroi>
      )}
      <div className="dr-negocios">
        {lista.map((p) => <CartaoProjeto key={p.missao} p={p} agora={agora} novo={m.novo} />)}
      </div>
      <section className="dr-feed" aria-label="Últimos passos">
        <h2 className="dr-rotulo">Últimos passos</h2>
        <ol className="dr-lista">
          {feed.map((e) => (
            <li key={e.id} className="dr-feed-item" data-novo={e.id === m.novo || undefined}>
              <span className="dr-feed-quem">{NOME_AGENTE[e.agente]} · {nomeDaMissao(e.missao)}</span>
              <span className="dr-feed-o-que">{e.tipo === "item" && e.fase === "feito" ? "Feito: " : ""}{e.titulo}</span>
              <time dateTime={e.em}>{haQuanto(e.em, agora)}</time>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
