import type { CSSProperties, ReactNode } from "react";
import { Bloco } from "@/design-system/Bloco";
import { moneyBRL } from "@/lib/store-utils";
import { LIMITE_ACABANDO, type ProdutosFlush } from "@/fontes/flush-produtos";
import type { NumerosFlush } from "@/fontes/useFlush";

/** Real inteiro: na lista, centavo é ruído. */
const sem0 = (v: number) => moneyBRL(Math.round(v)).replace(/,00$/, "");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const nomeDoMes = (mes: string) => new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
const restam = (q: number) => (q <= 0 ? "Esgotado" : `Resta${q > 1 ? "m" : ""} ${q}`);

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="dr-prod-secao" aria-label={titulo}>
      <h3 className="dr-prod-titulo">{titulo}{sub && <small>{sub}</small>}</h3>
      {children}
    </section>
  );
}

const Vazio = ({ children }: { children: ReactNode }) => <p className="ini-vazio-bloco cos-hachura dr-prod-vazio">{children}</p>;

function Conteudo({ p }: { p: ProdutosFlush }) {
  const mes = nomeDoMes(p.mes);
  return (
    <div className="dr-prod-grade">
      <Secao titulo="Mais vendidos" sub="7 dias">
        {p.maisVendidos.length === 0 ? <Vazio>Nenhuma venda nos últimos 7 dias.</Vazio> : (
          <ol className="dr-prod-lista">
            {p.maisVendidos.map((m, i) => (
              <li key={m.nome}>
                <span className="dr-prod-pos" aria-hidden="true">{i + 1}</span>
                <span className="dr-prod-nome">{m.nome}<small>{m.unidades === 1 ? "1 unidade" : `${m.unidades} unidades`}</small></span>
                <strong className="dr-prod-num">{sem0(m.faturamento)}</strong>
              </li>
            ))}
          </ol>
        )}
      </Secao>

      <Secao titulo="Acabando" sub={`${LIMITE_ACABANDO} ou menos`}>
        {p.acabando === null ? <Vazio>Não deu para ler o estoque da Flush.</Vazio>
          : p.acabando.length === 0 ? <Vazio>Estoque em dia: nenhum sabor perto de acabar.</Vazio> : (
          <ul className="dr-prod-lista">
            {p.acabando.map((s) => (
              <li key={s.id}>
                <span className="dr-prod-nome">{s.emoji ? `${s.emoji} ` : ""}{s.sabor}<small>{s.produto}</small></span>
                <span className="dr-prod-qtd" data-zero={s.quantidade <= 0 || undefined}>{restam(s.quantidade)}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Pagamento" sub={mes}>
        {p.formas.length === 0 ? <Vazio>Nenhuma venda em {mes} ainda.</Vazio> : (
          <ul className="dr-prod-lista">
            {p.formas.map((f) => (
              <li key={f.forma} className="dr-prod-forma">
                <span className="dr-prod-nome">{f.rotulo}<small>{pct(f.parte)}</small></span>
                <strong className="dr-prod-num">{sem0(f.valor)}</strong>
                <span className="dr-prod-barra" style={{ "--parte": Math.max(0, Math.min(1, f.parte)) } as CSSProperties} aria-hidden="true"><i /></span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

/** Flush: mais vendidos da semana, sabores acabando e o mês por forma de pagamento. Só leitura real. */
export function ProdutosDaFlush({ flush }: { flush: NumerosFlush }) {
  const atualizando = flush.estado.fase === "carregando" || (flush.estado.fase === "ok" && flush.estado.atualizando);
  let aviso: string | null = null;
  if (!flush.produtos) {
    if (atualizando) aviso = "Lendo produtos e estoque…";
    else if (flush.doServidor) aviso = "Sem leitura direta da Flush: produtos e estoque só aparecem com a FlushStore ligada neste aparelho (Sua conta).";
    else aviso = "Sem leitura da Flush. Ligue a FlushStore em Sua conta para ver produtos e estoque.";
  }
  return (
    <Bloco className="dr-proj dr-prod" aria-label="FlushStore: produtos e estoque">
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">Produtos e estoque</h2>
        <span className="dr-estado">Flush Principal</span>
      </div>
      {aviso ? <p className="dr-proj-linha">{aviso}</p> : flush.produtos && <Conteudo p={flush.produtos} />}
    </Bloco>
  );
}
