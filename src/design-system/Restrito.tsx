import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import "./primitivas.css";

/**
 * Informação que existe mas não é para quem está olhando (decisão do Rapha,
 * 12/10/2026): custo, margem, lucro ou movimento sensível de outra unidade.
 * Nunca R$ 0,00 no lugar, que parece um número de verdade. O cadeado e a
 * palavra dizem o que é; o leitor de tela ouve "informação restrita".
 */
export function Restrito({ tamanho = "m", className }: { tamanho?: "p" | "m" | "g" | "gg"; className?: string }) {
  return (
    <span className={cn("cos-restrito", `cos-restrito-${tamanho}`, className)} role="img" aria-label="Informação restrita">
      <Lock aria-hidden="true" />
      <span aria-hidden="true">Restrito</span>
    </span>
  );
}
