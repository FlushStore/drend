# DREND

Painel pessoal do Rapha. Só dele. Integra Flush, Vape Mania, vida pessoal e a memória (vaults Obsidian).

## Regras
- Escreva e responda em português do Brasil.
- Mobile é só iPhone: PWA aberto pela tela inicial (Safari → Adicionar à Tela de Início). Sem Android.
- O visual é o do painel da Flush (Control OS, repo FlushStore/puff-power-panel): `src/design-system` e `src/casca/*-v2.css`/`inicio*.css` foram copiados de lá em 24/10/2026. Não reinvente componentes: use os de `src/design-system` e as classes `cos-*`/`ini-*`. A única troca é a cor: azul no lugar do verde, só em `src/design-system/tokens.css`. O que é só do DREND fica em `src/casca/drend.css` (prefixo `dr-`).
- Tema claro e escuro, como na Flush (`data-v2-tema` no <html>, ver `src/casca/tema.ts`).
- Não mexa no app da FlushStore nem nos bancos da Flush ou da Vape Mania.
- Migrações em `supabase/migrations` vão só para o projeto Supabase do DREND, depois do ok do Rapha.
- Só dado real, nunca de exemplo (regra do Rapha, 24/10/2026: "quero programar ao vivo e ir evoluindo"). Sem fonte ligada, a tela fica vazia ou diz o que falta; nada de número, cartão ou seed fictício.
- O Mural só muda por operações de `src/core/mural.ts`; toda ação entra no log e pode ser desfeita.
- Ações seguem os níveis de `src/core/permissions.ts`: C e D pedem aprovação.

## Missões (registre seus passos)
O Rapha se perde entre projetos; a tela /missoes mostra todos ao vivo. Toda sessão que trabalha num projeto dele registra o passo ao começar e ao terminar:
- `node scripts/missao.mjs ver todas` antes de começar (o que já está em andamento).
- `node scripts/missao.mjs item <missao> <chave> agora "Título curto" ["detalhe"] [--ref https://…]` ao começar; o mesmo com `feito` ao terminar.
- `nota`, `decisao` e `pergunta` também existem. Pausar um projeto: `decisao <missao> "Pausado" --chave pausa`; retomar: `--chave retomada`.
- Missões: `drend`, `flush`, `vape-mania`, `flushfinance`, `doce-fornada`, `black-store`. Só fato real, nunca passo inventado.
- PRs deste repositório entram sozinhos (`.github/workflows/missoes.yml`, chave `pr-N`): não registre o PR à mão.
- No ambiente de nuvem o proxy põe o token; fora dele, `DREND_AGENTE_TOKEN`.

## Comandos
- `npm run dev` · `npm run build` · `npx vitest run`
