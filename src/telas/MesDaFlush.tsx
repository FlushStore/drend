import { Bloco } from "@/design-system/Bloco";
import { Delta } from "@/design-system/Delta";
import { Valor } from "@/design-system/Valor";
import type { MesFlush } from "@/core/financeiro";
import { moneyBRL } from "@/lib/store-utils";
import { MetaDaFlush } from "./MetaDaFlush";

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Real inteiro: na tela do mês, centavo é ruído. */
const sem0 = (v: number) => moneyBRL(Math.round(v)).replace(/,00$/, "");

/** O mês da Flush: até hoje, contra o mês passado no mesmo ponto, e a meta. */
export function MesDaFlush({ mes }: { mes: MesFlush }) {
  const titulo = mes.nome.charAt(0).toUpperCase() + mes.nome.slice(1);

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

      <MetaDaFlush mes={mes} />
    </Bloco>
  );
}
