import type { CSSProperties } from "react";
import { Trash2 } from "lucide-react";
import { Valor } from "@/design-system/Valor";
import type { useAviso } from "@/design-system/useAviso";
import { limitesDoMes, type LimiteNoMes } from "@/core/metas";
import { meioDiaEmBrasilia } from "@/core/brasilia";
import { reais } from "@/core/contas";
import { useStore } from "@/store";

type Avisar = ReturnType<typeof useAviso>["avisar"];

const ESTADO: Record<LimiteNoMes["estado"], string> = { dentro: "Dentro", perto: "Perto", passou: "Passou" };

/**
 * Limites de gasto do mês (Vida): gasto real do mês × o limite que o Rapha definiu no chat.
 * Sem limite definido, o bloco não aparece (a dica fica no Dinheiro).
 */
export function LimitesDoMes({ hoje, avisar }: { hoje: string; avisar: Avisar }) {
  const { metas, lancamentos, definirMeta, desfazerMeta } = useStore();
  const limites = limitesDoMes(metas, lancamentos, meioDiaEmBrasilia(hoje));
  if (!limites.length) return null;
  const passaram = limites.filter((l) => l.estado === "passou").length;

  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-vida-limites">
      <h2 id="dr-vida-limites" className="dr-rotulo">Limites {passaram > 0 && <span className="dr-conta" aria-label={`${passaram} passou do limite`}>{passaram}</span>}</h2>
      <ul className="dr-lista">
        {limites.map((l) => (
          <li key={l.chave} className="dr-vida-categoria dr-meta-limite" data-estado={l.estado}>
            <span className="dr-vida-linha">
              <span className="dr-tarefa-texto">
                {l.rotulo}
                <small className="dr-meta-limite-estado" data-estado={l.estado}>
                  {ESTADO[l.estado]} · {l.estado === "passou" ? `${reais(l.excesso)} acima` : `sobra ${reais(l.sobra)}`}
                </small>
              </span>
              <span className="dr-vida-valor">
                <span className="dr-meta-limite-valores"><Valor valor={l.gasto} tamanho="p" /><small> de {reais(l.limite)}</small></span>
                <button
                  type="button"
                  className="dr-vida-apagar"
                  aria-label={`Tirar o limite ${l.rotulo}`}
                  onClick={() => {
                    const tirada = definirMeta(l.chave, null);
                    avisar(`Limite “${l.rotulo}” tirado`, "sucesso", { rotulo: "Desfazer", aoTocar: () => desfazerMeta(tirada) });
                  }}
                >
                  <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            </span>
            <span className="dr-vida-barra dr-meta-limite-barra" data-estado={l.estado} aria-hidden="true"><i style={{ "--parte": Math.min(1, l.parte) } as CSSProperties} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
