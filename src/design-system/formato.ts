import { moneyBRL } from "@/lib/store-utils";

export interface PartesDeMoeda {
  negativo: boolean;
  inteiro: string;
  centavos: string;
  /** Texto completo ("R$ 1.234,50"), para leitor de tela. */
  texto: string;
}

/** Divide o valor em partes para o número-herói, pela formatação única do projeto (`moneyBRL`). */
export function partesDeMoeda(valor: number): PartesDeMoeda {
  const texto = moneyBRL(valor);
  const m = texto.match(/^R\$ (-?)([\d.]+),(\d{2})$/u);
  if (!m) return { negativo: false, inteiro: texto, centavos: "00", texto };
  return { negativo: m[1] === "-", inteiro: m[2], centavos: m[3], texto };
}

/** Minutos desde `iso` (nunca negativo); `null` sem data. */
export function minutosDesde(iso: string | null, agora: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((agora - t) / 60_000));
}

/** Tempo de espera: "3 min", "1 h 05", "2 dias". */
export function espera(minutos: number | null): string {
  if (minutos === null) return "sem horário";
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 24 * 60) return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`;
  const dias = Math.floor(minutos / (24 * 60));
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias" — para o carimbo de atualização. */
export function haQuanto(data: Date, agora: Date = new Date()): string {
  const seg = Math.max(0, Math.round((agora.getTime() - data.getTime()) / 1000));
  if (seg < 45) return "agora";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/**
 * Texto do carimbo e do "⋯": "Atualizando…", "Atualizado há 5 min", "Sem
 * atualizar desde 18:01" (a última tentativa falhou: a hora é o que importa,
 * nunca "pode estar desatualizado · atualizado agora") ou "Ainda não carregou".
 */
export function textoDaAtualizacao(
  atualizadoEm: Date | null,
  opcoes: { atualizando?: boolean; desatualizado?: boolean; agora?: Date } = {},
): string {
  if (opcoes.atualizando) return "Atualizando…";
  if (!atualizadoEm) return "Ainda não carregou";
  if (opcoes.desatualizado) {
    return `Sem atualizar desde ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `Atualizado ${haQuanto(atualizadoEm, opcoes.agora)}`;
}

/** Cor do sinal do dinheiro: verde entra/lucro, vermelho sai/despesa; neutro = tinta normal. */
export type TomValor = "neutro" | "positivo" | "negativo";

/** Tom pelo sinal do número (lucro, resultado): > 0 verde, < 0 vermelho, 0 neutro. */
export const tomDoSinal = (n: number): TomValor => (n > 0 ? "positivo" : n < 0 ? "negativo" : "neutro");

/**
 * Cor de um valor do dia contra a base (pedido do Rapha, 11/10): verde quando vai
 * melhor que ontem, vermelho quando vai pior; negativo é sempre vermelho; sem base
 * ou igual, neutro. Só exibição: nenhum cálculo muda.
 */
export function tomDoDia(atual: number, anterior: number | null | undefined): TomValor {
  if (atual < 0) return "negativo";
  if (anterior === null || anterior === undefined || atual === anterior) return "neutro";
  return atual > anterior ? "positivo" : "negativo";
}
