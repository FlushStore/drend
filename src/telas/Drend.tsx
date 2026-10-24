import { useNavigate } from "react-router-dom";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { DrendChat } from "@/casca/DrendChat";

/** A conversa como tela, no iPhone (no PC ela abre no painel da direita). */
export function Drend() {
  const navigate = useNavigate();
  return (
    <>
      <CabecalhoDeTela titulo="DREND" sub="Texto ou voz. Tudo que eu faço fica no histórico." voltar={{ para: "/", rotulo: "Voltar para Hoje" }} />
      <DrendChat aoAbrirMural={() => navigate("/mural")} />
    </>
  );
}
