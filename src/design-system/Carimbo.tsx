import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BotaoCirculo } from "./BotaoCirculo";
import { textoDaAtualizacao } from "./formato";
import "./base.css";
import "./primitivas.css";

const INTERVALO_DO_RELOGIO_MS = 30_000;

export interface CarimboProps {
  /** Quando os dados chegaram (`null` = ainda não carregou). */
  atualizadoEm: Date | null;
  aoAtualizar: () => void;
  /** Busca em andamento (ex.: `isFetching` da consulta). */
  atualizando?: boolean;
  /** Dados possivelmente velhos (ex.: última tentativa falhou): o ponto fica neutro. */
  desatualizado?: boolean;
  /** Relógio injetável (testes). */
  agora?: () => Date;
}

/** "Atualizado há…" + botão de atualizar. O texto se renova sozinho a cada 30 s. */
export function Carimbo({ atualizadoEm, aoAtualizar, atualizando = false, desatualizado = false, agora }: CarimboProps) {
  const [, setTique] = useState(0);
  useEffect(() => {
    const relogio = window.setInterval(() => setTique((n) => n + 1), INTERVALO_DO_RELOGIO_MS);
    return () => window.clearInterval(relogio);
  }, []);

  const texto = textoDaAtualizacao(atualizadoEm, { atualizando, desatualizado, agora: agora?.() });

  return (
    <div className="cos-carimbo" data-atualizando={atualizando || undefined} data-desatualizado={desatualizado || undefined}>
      <span className="cos-carimbo-ponto" aria-hidden="true" />
      <span>{texto}</span>
      {/* Só a troca de estado é anunciada; o "há N min" que muda sozinho não. */}
      <span className="cos-sr" role="status">{atualizando ? "Atualizando…" : ""}</span>
      <BotaoCirculo rotulo="Atualizar agora" onClick={aoAtualizar} disabled={atualizando}>
        <RefreshCw size={16} strokeWidth={1.75} className={atualizando ? "cos-gira" : undefined} />
      </BotaoCirculo>
    </div>
  );
}
