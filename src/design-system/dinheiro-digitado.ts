/**
 * Dinheiro digitado "de maquininha" (InfinitePay, pedido do Rapha de 16/10): cada dígito
 * entra pela direita. "1" → 0,01; "15" → 0,15; "1500" → 15,00. Puro: o campo
 * (`CampoDeDinheiro`) e o teclado do balcão usam as mesmas regras. O texto devolvido é o
 * que `lerValorBR` lê ("1.234,56"); zero vira "" para o placeholder "0,00" aparecer.
 */
import { lerValorBR } from "@/lib/valor-br";

/** Nove dígitos: até R$ 9.999.999,99. */
export const MAXIMO_DE_DIGITOS = 9;

/** 150 → "1,50" · 123456 → "1.234,56". */
export function textoDeCentavos(centavos: number): string {
  const c = Math.max(0, Math.round(centavos));
  const inteiro = Math.floor(c / 100).toLocaleString("pt-BR");
  return `${inteiro},${String(c % 100).padStart(2, "0")}`;
}

/**
 * Texto colado no campo → texto do valor, pela regra única `lerValorBR` (regra da Flush:
 * dinheiro digitado sempre passa por ela). Negativo, "1 5", "1,234.56" ou ilegível → `null`
 * (o campo recusa e fica como estava). "15.5" vira 15,50, não 1,55.
 */
export function colarValor(texto: string): string | null {
  const n = lerValorBR(texto);
  if (n === undefined || n < 0 || Math.round(n * 100) > 10 ** MAXIMO_DE_DIGITOS - 1) return null;
  return n === 0 ? "" : textoDeCentavos(Math.round(n * 100));
}

/**
 * O que está no campo (só os dígitos contam) → texto do valor. Com sinal de menos o campo
 * recusa (`null`): tirar o "-" e seguir trocaria um negativo por positivo calado.
 */
export function digitarNoCampo(campo: string): string | null {
  return campo.includes("-") ? null : digitarCentavos(campo);
}

/** Só os dígitos, da direita para a esquerda → texto do valor. */
export function digitarCentavos(campo: string): string {
  const digitos = campo.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAXIMO_DE_DIGITOS);
  return digitos ? textoDeCentavos(Number(digitos)) : "";
}

const JA_NO_FORMATO = /^\d{1,3}(\.\d{3})*,\d{2}$/;

/**
 * Valor que chegou de fora (do banco, de um rascunho, de um atalho "R$ 50") → como o campo
 * mostra. Sem isso, "150,5" viraria 15,05 no primeiro dígito tocado.
 */
export function valorNoCampo(texto: string): string {
  const t = texto.trim();
  if (!t || JA_NO_FORMATO.test(t)) return t;
  const n = lerValorBR(t);
  return n === undefined || n <= 0 ? "" : textoDeCentavos(Math.round(n * 100));
}

/** Tecla do teclado do balcão: dígito, "00" ou apagar (tira o último dígito). */
export function teclarCentavos(valor: string, tecla: string): string {
  const digitos = valorNoCampo(valor).replace(/\D/g, "");
  if (tecla === "apagar") return digitarCentavos(digitos.slice(0, -1));
  if (digitos.replace(/^0+/, "").length + tecla.length > MAXIMO_DE_DIGITOS) return valorNoCampo(valor);
  return digitarCentavos(digitos + tecla);
}
