import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { AgendaDaSemana } from "./AgendaDaSemana";

/** Só o que é real: a agenda. Dinheiro, metas e linha do tempo entram quando tiverem fonte. */
export function Vida() {
  return (
    <>
      <CabecalhoDeTela titulo="Vida" />
      <AgendaDaSemana />
    </>
  );
}
