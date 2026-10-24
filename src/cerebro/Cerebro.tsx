import { lazy, Suspense } from "react";
import "./cerebro.css";

const Cena = lazy(() => import("./CerebroCena"));

/** O cérebro do DREND. `atividade` muda a cada pedido (rajada); `pensando` acelera a rede. */
export function Cerebro({ atividade = 0, pensando = false, tamanho = "g" }: { atividade?: number; pensando?: boolean; tamanho?: "g" | "p" }) {
  return (
    <div className="dr-cerebro" data-tamanho={tamanho} data-pensando={pensando || undefined}>
      <Suspense fallback={<div className="dr-cerebro-cena" />}>
        <Cena atividade={atividade} pensando={pensando} />
      </Suspense>
    </div>
  );
}
