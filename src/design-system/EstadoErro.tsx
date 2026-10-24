import type { ReactNode } from "react";
import { CloudOff, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Botao } from "./Botao";
import "./base.css";
import "./primitivas.css";
import "./estados.css";

export interface EstadoErroProps {
  titulo?: string;
  texto?: ReactNode;
  aoTentarDeNovo: () => void;
  /** Nova tentativa em andamento: o botão fica ocupado. */
  tentando?: boolean;
  nivel?: 2 | 3;
  className?: string;
}

/** Falha de carregamento em linguagem simples, sempre com "Tentar de novo". */
export function EstadoErro({
  titulo = "Não deu para carregar",
  texto = "Confira a internet e tente de novo. Nada foi perdido.",
  aoTentarDeNovo,
  tentando = false,
  nivel = 2,
  className,
}: EstadoErroProps) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <div className={cn("cos-bloco cos-erro", className)} role="alert">
      <span className="cos-erro-icone" aria-hidden="true"><CloudOff size={22} strokeWidth={1.75} /></span>
      <div>
        <Titulo className="cos-estado-titulo">{titulo}</Titulo>
        {texto && <p className="cos-estado-texto">{texto}</p>}
      </div>
      <Botao variante="secundaria" onClick={aoTentarDeNovo} ocupado={tentando} icone={<RotateCw size={16} strokeWidth={2} />}>
        Tentar de novo
      </Botao>
    </div>
  );
}
