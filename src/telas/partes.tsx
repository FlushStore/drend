import type { ReactNode } from "react";

/** Estado curto ao lado do título do bloco ("Operando", "Fase 4"). */
export function Estado({ tom, children }: { tom: "ok" | "acento" | "neutro"; children: ReactNode }) {
  return <span className="dr-estado" data-tom={tom}>{children}</span>;
}

/** Linhas rótulo · valor, como o detalhe dos blocos do painel da Flush. */
export function Linhas({ linhas }: { linhas: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className="dr-linhas">
      {linhas.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
