/**
 * Regra da proporção no PC (16/10/2026) — ver docs/AI_DECISIONS.md.
 *
 * O Rapha usava a loja e o Control OS com o zoom do navegador em 80–90% no PC:
 * a 100%, num notebook de 1366–1536 px, tudo parecia grande. A loja (flush.css)
 * e o painel (design-system, casca e features) são escritos em `px`, então não
 * existe um `rem` para encolher. Esta etapa do PostCSS reescreve, só nesses
 * arquivos, cada medida em px > 1 como `calc(Npx * var(--escala, 1))`:
 *
 *   - o fonte continua legível, com os px de sempre;
 *   - quem decide o tamanho é UM token por superfície (`--r-escala` na loja,
 *     `--cos-escala` no painel), que vale 1 por padrão e só muda dentro de
 *     `@media (min-width: 1024px) and (pointer: fine)`;
 *   - com o token em 1 (celular, tablet de toque), `calc(Npx * 1)` = Npx: o
 *     celular fica idêntico, pixel a pixel;
 *   - `vw`, `%`, `rem` e os breakpoints (`@media`) não são tocados, como no zoom
 *     do navegador (onde `vw` também não muda de proporção);
 *   - medidas de 1 px ou menos (fio de borda, letter-spacing) ficam como estão.
 *
 * Fora da raiz de cada superfície o token não existe e o fallback 1 mantém o
 * tamanho original — nada vaza para o painel antigo nem para outras telas.
 */
import valueParser from "postcss-value-parser";

/** Arquivo → token. A ordem importa: o primeiro que casar vence. */
export const ALVOS_DA_ESCALA = [
  { teste: /[\\/]src[\\/](design-system|casca|telas)[\\/].+\.css$/, variavel: "--cos-escala" },
];

const PX = /(?:^|[^\w.-])-?(?:\d+\.?\d*|\.\d+)px\b/i;

/** Reescreve os px de um valor de declaração. Exportada para o teste-guarda. */
export function escalarPx(valor, variavel) {
  if (!PX.test(valor)) return valor;
  const arvore = valueParser(valor);
  arvore.walk((no) => {
    if (no.type === "function" && no.value.toLowerCase() === "url") return false;
    if (no.type !== "word") return undefined;
    const unidade = valueParser.unit(no.value);
    if (!unidade || unidade.unit.toLowerCase() !== "px") return undefined;
    const numero = Number.parseFloat(unidade.number);
    if (!Number.isFinite(numero) || Math.abs(numero) <= 1) return undefined;
    no.value = `calc(${unidade.number}px * var(${variavel}, 1))`;
    return undefined;
  });
  return arvore.toString();
}

export function variavelDoArquivo(arquivo) {
  if (!arquivo) return null;
  const alvo = ALVOS_DA_ESCALA.find((a) => a.teste.test(arquivo));
  return alvo ? alvo.variavel : null;
}

/** Plugin PostCSS. */
export default function escalaDesktop() {
  return {
    postcssPlugin: "drend-escala-desktop",
    Once(raiz) {
      const variavel = variavelDoArquivo(raiz.source?.input?.file);
      if (!variavel) return;
      raiz.walkDecls((decl) => {
        // O próprio token e os tokens de escala nunca são reescritos.
        if (decl.prop.endsWith("-escala")) return;
        const novo = escalarPx(decl.value, variavel);
        if (novo !== decl.value) decl.value = novo;
      });
    },
  };
}
escalaDesktop.postcss = true;
