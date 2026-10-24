import { cn } from "@/lib/utils";

export type VarianteBotao = "primaria" | "secundaria" | "fantasma";

/**
 * Classes do botão, para quando o alvo precisa ser um link (`<Link className={classesDoBotao()}>`).
 * Primária = acento (a ação principal da tela); secundária = grafite; fantasma = contorno.
 */
export function classesDoBotao(variante: VarianteBotao = "primaria", largo = false, extra?: string): string {
  return cn("cos-botao", `cos-botao-${variante}`, largo && "cos-botao-largo", extra);
}
