import { useMemo, useState } from "react";
import { Bloco } from "@/design-system/Bloco";
import { Botao } from "@/design-system/Botao";
import { Segmentado } from "@/design-system/Segmentado";
import { Aviso } from "@/design-system/Aviso";
import { useAviso } from "@/design-system/useAviso";
import { classesDoBotao } from "@/design-system/classes";
import { LIMITE_ACABANDO } from "@/fontes/flush-produtos";
import {
  COBERTURA_PADRAO, COBERTURAS, ehCobertura, linkDoWhatsApp, montarReposicao, textoDoPedido,
  type Cobertura, type GiroFlush,
} from "@/fontes/flush-reposicao";
import type { NumerosFlush } from "@/fontes/useFlush";

const CHAVE = "drend:reposicao:cobertura";
const OPCOES = COBERTURAS.map((c) => ({ valor: String(c) as `${Cobertura}`, rotulo: `${c} dias` }));

function lerCobertura(): Cobertura {
  try {
    const v = localStorage.getItem(CHAVE);
    if (ehCobertura(v)) return Number(v) as Cobertura;
  } catch { /* sem armazenamento: fica o padrão */ }
  return COBERTURA_PADRAO;
}

function guardarCobertura(c: Cobertura) {
  try { localStorage.setItem(CHAVE, String(c)); } catch { /* só não lembra */ }
}

/** Clipboard API; sem ela (ou negada), o textarea com execCommand. */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* tenta o outro jeito */ }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

const vendeu = (n: number, dias: number) => (n === 1 ? `1 vendida em ${dias} dias` : `${n} vendidas em ${dias} dias`);
const tem = (q: number) => (q <= 0 ? "esgotado" : `tem ${q}`);
const foraDaLista = (n: number, dias: number) => (n === 1
  ? `1 sabor acabando não vendeu em ${dias} dias e ficou de fora.`
  : `${n} sabores acabando não venderam em ${dias} dias e ficaram de fora.`);

function Lista({ giro, cobertura }: { giro: GiroFlush; cobertura: Cobertura }) {
  const { aviso, avisar, limpar } = useAviso();
  const r = useMemo(() => montarReposicao(giro, cobertura), [giro, cobertura]);
  const texto = useMemo(() => textoDoPedido(r), [r]);
  const criterio = r.janela < cobertura
    ? `Sabores com ${LIMITE_ACABANDO} ou menos; cobre ${cobertura} dias de venda (média dos ${r.janela} dias lidos).`
    : `Sabores com ${LIMITE_ACABANDO} ou menos; cobre ${cobertura} dias de venda.`;

  return (
    <>
      <p className="dr-proj-linha">{criterio}</p>
      {r.grupos.length === 0 ? (
        <p className="ini-vazio-bloco cos-hachura dr-prod-vazio">Estoque em dia.</p>
      ) : (
        <>
          <div className="dr-rep-grade">
            {r.grupos.map((g) => (
              <section key={g.produto} className="dr-prod-secao" aria-label={g.produto}>
                <h3 className="dr-prod-titulo">{g.produto}</h3>
                <ul className="dr-prod-lista">
                  {g.sabores.map((s) => (
                    <li key={s.id}>
                      <span className="dr-prod-nome">{s.emoji ? `${s.emoji} ` : ""}{s.sabor}<small>{tem(s.estoque)} · {vendeu(s.vendidos, r.janela)}</small></span>
                      <strong className="dr-rep-qtd" aria-label={`Pedir ${s.sugestao}`}>+{s.sugestao}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="dr-rep-rodape">
            <span className="dr-rep-total">{r.total === 1 ? "1 unidade" : `${r.total} unidades`}</span>
            <div className="dr-rep-acoes">
              <Botao variante="secundaria" compacto onClick={async () => {
                if (await copiar(texto)) avisar("Pedido copiado");
                else avisar("Não deu para copiar o pedido", "erro");
              }}>Copiar pedido</Botao>
              <a className={classesDoBotao("primaria", false, "cos-botao-compacto")} href={linkDoWhatsApp(texto)} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>
            </div>
          </div>
        </>
      )}
      {r.semGiro > 0 && <p className="dr-rep-nota">{foraDaLista(r.semGiro, r.janela)}</p>}
      <Aviso aviso={aviso} aoSumir={limpar} />
    </>
  );
}

/** Flush: o que repor, pelo giro de cada sabor acabando. Só monta o texto; quem envia é o Rapha. */
export function ReposicaoDaFlush({ flush }: { flush: NumerosFlush }) {
  const [cobertura, setCobertura] = useState<Cobertura>(lerCobertura);
  const giro = flush.produtos?.giro;
  const atualizando = flush.estado.fase === "carregando" || (flush.estado.fase === "ok" && flush.estado.atualizando);
  let aviso: string | null = null;
  if (!giro) {
    if (atualizando) aviso = "Lendo estoque e vendas…";
    else if (flush.produtos && giro === null) aviso = "Não deu para ler o estoque da Flush.";
    else if (flush.produtos) aviso = "A reposição aparece na próxima leitura da Flush.";
    else if (flush.doServidor) aviso = "Sem leitura direta da Flush: a reposição precisa do estoque e das vendas por sabor, que só vêm com a FlushStore ligada neste aparelho (Sua conta).";
    else aviso = "Sem leitura da Flush. Ligue a FlushStore em Sua conta para montar a reposição.";
  }
  return (
    <Bloco className="dr-proj dr-prod dr-rep" aria-label="FlushStore: reposição">
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">Reposição</h2>
        {giro && (
          <Segmentado
            rotulo="Cobertura"
            opcoes={OPCOES}
            valor={String(cobertura) as `${Cobertura}`}
            aoMudar={(v) => { const c = Number(v) as Cobertura; setCobertura(c); guardarCobertura(c); }}
          />
        )}
      </div>
      {aviso ? <p className="dr-proj-linha">{aviso}</p> : giro && <Lista giro={giro} cobertura={cobertura} />}
    </Bloco>
  );
}
