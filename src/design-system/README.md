# Design system do Control OS (`/backstage`)

A direção **Estúdio** (Missão 2A, aprovada) como código de produção. O laboratório
(`src/lab/estudio/`) fica como histórico e **não** é importado daqui.

## O que existe

| Arquivo | Para quê | Props principais |
|---|---|---|
| `tokens.css` | Cores claro/escuro, superfícies, raios, sombras, tipografia, movimento, áreas seguras (`--cos-*`) | — |
| `base.css` | Reset escopado, foco, `.cos-sr`, `.cos-hachura`, movimento reduzido | — |
| `Botao.tsx` / `classes.ts` | Botão pílula; `classesDoBotao()` para links | `variante` primaria·secundaria·fantasma, `ocupado`, `largo`, `icone` |
| `BotaoCirculo.tsx` | Ícone em círculo de 44 px; `SetaCirculo` decorativa | `rotulo` (obrigatório), `tom` |
| `Segmentado.tsx` | Escolha com indicador que desliza; setas/Home/End | `opcoes`, `valor`, `aoMudar`, `rotulo`, `papel` radio·abas, `tom` |
| `Bloco.tsx` | `Bloco`, `BlocoHeroi`, `TituloBloco` | `como`, `hachura` |
| `Palco.tsx` | Foto de produto 1:1 no "palco de papel"; sem foto, o selo do sabor | `foto`, `largura`, `sabor`, `emoji` |
| `Valor.tsx` | R$ grande, centavos discretos, tabular (formata com `moneyBRL`) | `valor`, `tamanho` p·m·g·gg |
| `SeloEmoji.tsx` | `SeloEmoji` (aria-hidden) e `NomeSabor` — regra de `resolveEmoji` | `nome`, `emoji` (do banco), `tamanho` |
| `Carimbo.tsx` | "Atualizado há…" + atualizar | `atualizadoEm`, `aoAtualizar`, `atualizando`, `desatualizado` |
| `Esqueleto.tsx` | `Esqueleto` (status) + `Osso` | `rotulo`; `altura`, `largura`, `raio` |
| `EstadoVazio.tsx` / `EstadoErro.tsx` | Vazio que orienta; erro com "Tentar de novo" | `titulo`, `texto`, `acao` / `aoTentarDeNovo`, `tentando` |
| `Aviso.tsx` + `useAviso.ts` | Toast em região viva | `aviso`, `aoSumir`, `duracaoMs` |
| `Doca.tsx` | Navegação do celular; some ao rolar (`useBarraAoRolar`) | `itens`, `ativo`, `mais`, `aoNavegar`, `elementoDeRolagem`; item com `sai` ganha marca discreta (destino fora da casca) |
| `MenuMais.tsx` | O "+" expandido | `aberto`, `aoFechar`, `origem` doca·topo, `secoes` |
| `AbasTopo.tsx` | Abas centradas do desktop | `itens`, `ativo`, `aoNavegar` |
| `Busca.tsx` | Busca universal (cmdk + diálogo Radix) | `aberto`, `aoFechar`, `grupos`, `consulta`/`aoMudarConsulta`, `filtrar`, `carregando` |
| `ConfirmarAcao.tsx` | Segundo toque antes de ação que não volta; "Voltar" com foco; Escape cancela só ela | `rotulo`, `textoConfirmar`, `aoConfirmar`, `aoCancelar`, `ocupado`, `variante` |
| `Painel.tsx` | Painel vaul: de baixo no celular, à direita no desktop | `aberto`, `aoFechar`, `titulo`, `lado`, `rodape`, `ocultarCabecalho` |
| `movimento.ts` | Curvas/molas e `useMovimentoReduzido()` | — |
| `useTelaLarga.ts` | `true` a partir de 1024 px | — |

## Como usar

1. A casca envolve tudo em `<div className="cos-raiz">` e chama `useAplicarTema()`
   (`src/features/preferencias/aplicarTema.ts`), que escreve `data-v2-tema` no `<html>`.
   Não existe outro mecanismo de tema.
2. Importe cada componente do seu arquivo (sem barrel, ADR-002):
   `import { Botao } from "@/design-system/Botao"`. Cada um importa o próprio CSS.
3. Dados entram **só por props**. Nada aqui busca no banco, conhece pedido, produto ou rota fixa.
4. Camadas em portal (`Busca`, `Painel`) já levam `.cos-raiz`; `Aviso` e `MenuMais` ficam
   dentro da casca.

## Regras

- **Acento só para ação, seleção e dado.** Nunca decoração nem fundo de seção.
- **Um herói por tela** (`BlocoHeroi`): a resposta para "o que faço agora?".
- Hachura = "ainda não aconteceu / previsto / vazio".
- Alvo de toque ≥ 44 px; ícone sozinho sempre com nome acessível (`rotulo`).
- Movimento: só `opacity`/`transform`; `prefers-reduced-motion` desliga deslocamentos
  (CSS em `base.css`, motion via `useMovimentoReduzido`).
- Sem `as any`, sem `console.log`, sem prefixos herdados (`flush-`, `bk-`, `r-`); classes `cos-*`.
- Arquivo pequeno e com uma responsabilidade (≤ ~200 linhas).

Testes: `src/test/design-system.test.tsx`.
