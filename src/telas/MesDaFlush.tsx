import { useState, type CSSProperties } from "react";
import { Bloco } from "@/design-system/Bloco";
import { Botao } from "@/design-system/Botao";
import { CampoDeDinheiro } from "@/design-system/CampoDeDinheiro";
import { Delta } from "@/design-system/Delta";
import { Valor } from "@/design-system/Valor";
import { progressoMeta, type MesFlush } from "@/core/financeiro";
import { lerValorBR } from "@/lib/valor-br";
import { moneyBRL } from "@/lib/store-utils";
import { META_FLUSH_MES, useStore } from "@/store";

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Real inteiro: na tela do mês, centavo é ruído. */
const sem0 = (v: number) => moneyBRL(Math.round(v)).replace(/,00$/, "");

/** O mês da Flush: até hoje, contra o mês passado no mesmo ponto, e a meta. */
export function MesDaFlush({ mes }: { mes: MesFlush }) {
  const { metas, definirMeta } = useStore();
  const meta = metas[META_FLUSH_MES] ?? null;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const p = meta ? progressoMeta(mes, meta) : null;
  const titulo = mes.nome.charAt(0).toUpperCase() + mes.nome.slice(1);

  function abrir() {
    setTexto(meta ? meta.toFixed(2).replace(".", ",") : "");
    setEditando(true);
  }
  function salvar() {
    const v = lerValorBR(texto);
    definirMeta(META_FLUSH_MES, v && v > 0 ? v : null);
    setEditando(false);
  }

  return (
    <Bloco className="dr-proj dr-mes" aria-label={`FlushStore em ${mes.nome}`}>
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">{titulo}</h2>
        <span className="dr-estado">dia {mes.diasPassados} de {mes.diasNoMes}</span>
      </div>
      <div className="dr-mes-total">
        <Valor valor={mes.atual.valor} tamanho="g" centavos={false} />
        <Delta compacto atual={mes.atual.valor} anterior={mes.variacao === null ? null : mes.anterior.ateHoje.valor}
          rotulo={`${mes.anterior.nome} até o dia ${Math.min(mes.diasPassados, 31)}`} curto={mes.anterior.nome} />
      </div>
      <dl className="dr-numeros dr-numeros-p">
        <div><dt>Lucro</dt><dd><Valor valor={mes.atual.lucro} tamanho="m" centavos={false} /></dd></div>
        <div><dt>Margem</dt><dd className="dr-mes-num">{mes.margem === null ? "—" : pct(mes.margem)}</dd></div>
        <div><dt>Pedidos</dt><dd className="dr-mes-num">{mes.atual.pedidos}</dd></div>
        <div><dt>Ticket</dt><dd className="dr-mes-num">{mes.ticket === null ? "—" : sem0(mes.ticket)}</dd></div>
      </dl>

      {editando ? (
        <form className="dr-meta-form" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          <label className="cos-entrada">
            <span className="cos-sr">Meta de faturamento do mês</span>
            <CampoDeDinheiro valor={texto} aoMudar={setTexto} autoFocus />
          </label>
          <Botao type="submit" compacto>Salvar</Botao>
          <Botao variante="fantasma" compacto onClick={() => setEditando(false)}>Cancelar</Botao>
        </form>
      ) : p ? (
        <div className="dr-meta">
          <div className="dr-barra" data-batida={p.falta === 0 || undefined} style={{ "--parte": Math.min(1, p.feito) } as CSSProperties} aria-hidden="true"><i /></div>
          <p className="dr-proj-linha">
            {p.falta === 0
              ? <>Meta de {sem0(p.meta)} batida.</>
              : <>Meta {sem0(p.meta)}: {pct(p.feito)} feito, faltam <strong>{sem0(p.falta)}</strong>{p.porDia ? <> ({sem0(p.porDia)}/dia)</> : null}. {p.noRitmo ? "No ritmo, bate." : `No ritmo, fecha em ${sem0(mes.projecao)}.`}</>}
            {" "}<button type="button" className="dr-mi-mais" onClick={abrir}>Mudar</button>
          </p>
        </div>
      ) : (
        <p className="dr-proj-linha">
          No ritmo de agora, fecha o mês em <strong>{sem0(mes.projecao)}</strong>.{" "}
          <button type="button" className="dr-mi-mais" onClick={abrir}>Definir meta</button>
        </p>
      )}
    </Bloco>
  );
}
