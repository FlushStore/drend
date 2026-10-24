import { Component, lazy, Suspense, type ReactNode } from "react";
import "./cerebro.css";

const Cena = lazy(() => import("./CerebroCena"));

/** Se o pedaço do 3D não carregar (sem internet, versão velha), some só o cérebro. */
class SemCerebro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    return this.state.erro ? <div className="dr-cerebro-cena" /> : this.props.children;
  }
}

/** O cérebro do DREND. `atividade` muda a cada pedido (rajada); `pensando` acelera a rede. */
export function Cerebro({ atividade = 0, pensando = false, tamanho = "g" }: { atividade?: number; pensando?: boolean; tamanho?: "g" | "p" }) {
  return (
    <div className="dr-cerebro" data-tamanho={tamanho} data-pensando={pensando || undefined}>
      <SemCerebro>
        <Suspense fallback={<div className="dr-cerebro-cena" />}>
          <Cena atividade={atividade} pensando={pensando} />
        </Suspense>
      </SemCerebro>
    </div>
  );
}
