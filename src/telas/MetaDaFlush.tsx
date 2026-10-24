import { useState, type CSSProperties } from "react";
import { Bloco } from "@/design-system/Bloco";
import { Botao } from "@/design-system/Botao";
import { CampoDeDinheiro } from "@/design-system/CampoDeDinheiro";
import { Valor } from "@/design-system/Valor";
import type { MesFlush } from "@/core/financeiro";
import { META_FLUSH_MES, progressoDaMeta } from "@/core/metas";
import { useDiaEmBrasilia } from "@/lib/useDiaEmBrasilia";
import { meioDiaEmBrasilia } from "@/core/brasilia";
import { lerValorBR } from "@/lib/valor-br";
import { moneyBRL } from "@/lib/store-utils";
import { useStore } from "@/store";

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Real inteiro: na meta, centavo é ruído. */
const sem0 = (v: number) => moneyBRL(Math.round(v)).replace(/,00$/, "");

/** Editar a meta: o mesmo campo de dinheiro do resto do painel. */
function useEditarMeta() {
  const { metas, definirMeta } = useStore();
  const meta = metas[META_FLUSH_MES] ?? null;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  return {
    meta,
    editando,
    abrir() {
      setTexto(meta ? meta.toFixed(2).replace(".", ",") : "");
      setEditando(true);
    },
    form: (
      <form className="dr-meta-form" onSubmit={(e) => {
        e.preventDefault();
        const v = lerValorBR(texto);
        definirMeta(META_FLUSH_MES, v && v > 0 ? v : null);
        setEditando(false);
      }}>
        <label className="cos-entrada">
          <span className="cos-sr">Meta de faturamento do mês</span>
          <CampoDeDinheiro valor={texto} aoMudar={setTexto} autoFocus />
        </label>
        <Botao type="submit" compacto>Salvar</Botao>
        <Botao variante="fantasma" compacto onClick={() => setEditando(false)}>Cancelar</Botao>
      </form>
    ),
  };
}

/**
 * A meta de faturamento dentro do mês da Flush: quanto já faturou, % da meta, quanto falta
 * e quanto por dia nos dias que restam (Brasília). Sem meta, uma linha para definir.
 */
export function MetaDaFlush({ mes }: { mes: MesFlush }) {
  const { meta, editando, abrir, form } = useEditarMeta();
  const hoje = useDiaEmBrasilia();
  if (editando) return form;
  if (!meta) {
    return (
      <p className="dr-proj-linha">
        No ritmo de agora, fecha o mês em <strong>{sem0(mes.projecao)}</strong>.{" "}
        <button type="button" className="dr-mi-mais" onClick={abrir}>Definir meta</button>
      </p>
    );
  }
  const p = progressoDaMeta(meta, mes.atual.valor, meioDiaEmBrasilia(hoje));
  return (
    <div className="dr-meta-flush">
      <div className="dr-meta-flush-cab">
        <span className="dr-rotulo">Meta {sem0(meta)}</span>
        <strong className="dr-meta-flush-pct">{pct(p.feito)}</strong>
      </div>
      <div className="dr-barra" data-batida={p.batida || undefined} style={{ "--parte": Math.min(1, p.feito) } as CSSProperties} aria-hidden="true"><i /></div>
      {p.batida ? (
        <p className="dr-proj-linha">Meta batida. <button type="button" className="dr-mi-mais" onClick={abrir}>Mudar</button></p>
      ) : (
        <>
          <dl className="dr-numeros dr-numeros-p">
            <div><dt>Faturado</dt><dd><Valor valor={p.faturado} tamanho="m" centavos={false} /></dd></div>
            <div><dt>Falta</dt><dd><Valor valor={p.falta} tamanho="m" centavos={false} /></dd></div>
            <div><dt>Por dia</dt><dd><Valor valor={p.porDia ?? 0} tamanho="m" centavos={false} /></dd></div>
          </dl>
          <p className="dr-proj-linha">
            {p.diasRestantes === 1 ? "Último dia" : `${p.diasRestantes} dias restantes`} · {mes.projecao >= meta ? "no ritmo, bate" : `no ritmo, fecha em ${sem0(mes.projecao)}`}.{" "}
            <button type="button" className="dr-mi-mais" onClick={abrir}>Mudar</button>
          </p>
        </>
      )}
    </div>
  );
}

/** Sem o mês lido da Flush: só a meta, e o que falta para ver o progresso. Sem meta, nada. */
export function MetaSemLeitura({ lendo }: { lendo: boolean }) {
  const { meta, editando, abrir, form } = useEditarMeta();
  if (!meta) return null;
  return (
    <Bloco className="dr-proj" aria-label="Meta da FlushStore">
      <div className="dr-proj-cab">
        <h2 className="dr-proj-nome">Meta do mês</h2>
        <Valor valor={meta} tamanho="m" centavos={false} />
      </div>
      {editando ? form : (
        <p className="dr-proj-linha">
          {lendo ? "Lendo as vendas…" : "Falta a leitura da Flush para ver o progresso."}{" "}
          <button type="button" className="dr-mi-mais" onClick={abrir}>Mudar</button>
        </p>
      )}
    </Bloco>
  );
}
