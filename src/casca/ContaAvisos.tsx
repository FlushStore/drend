import { useEffect, useState } from "react";
import { Botao } from "@/design-system/Botao";
import { useStore } from "@/store";
import { desligarAvisos, estadoDosAvisos, ligarAvisos, type EstadoAvisos } from "@/fontes/avisos";

const TEXTO: Record<EstadoAvisos, string> = {
  "sem-suporte": "Este aparelho não recebe avisos.",
  "fora-do-app": "No iPhone, abra o DREND pelo ícone da Tela de Início para ligar os avisos.",
  negado: "Avisos recusados. Libere em Ajustes → Notificações → DREND.",
  desligado: "Desligados",
  ligado: "Ligados: resumo às 7h30 e aviso antes de cada compromisso",
};

/** Liga os avisos neste aparelho: resumo da manhã e compromisso chegando. */
export function ContaAvisos() {
  const { email } = useStore();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void estadoDosAvisos().then(setEstado).catch(() => setEstado("sem-suporte"));
  }, []);

  if (!email || !estado) return null;

  async function alternar() {
    setOcupado(true);
    setAviso(null);
    if (estado === "ligado") await desligarAvisos();
    else setAviso(await ligarAvisos());
    setEstado(await estadoDosAvisos());
    setOcupado(false);
  }

  const podeLigar = estado === "desligado" || estado === "ligado";
  return (
    <div className="dr-nuvem">
      <span className="cv2-conta-rotulo">Avisos no iPhone</span>
      <dl className="cv2-conta-dados">
        <div><dt>Avisos</dt><dd><i className="dr-ponto" data-tom={estado === "ligado" ? "ok" : undefined} aria-hidden="true" />{TEXTO[estado]}</dd></div>
      </dl>
      {aviso && <p className="dr-nuvem-aviso" role="status">{aviso}</p>}
      {podeLigar && <Botao variante={estado === "ligado" ? "secundaria" : undefined} largo ocupado={ocupado} onClick={() => void alternar()}>{estado === "ligado" ? "Desligar os avisos" : "Ligar os avisos"}</Botao>}
    </div>
  );
}
