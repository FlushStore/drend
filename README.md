# DREND

Painel pessoal do Rapha: Hoje, Negócios, Mural, Vida e o DREND (assistente por texto ou voz).

- Web no computador e PWA no iPhone (Safari → Compartilhar → Adicionar à Tela de Início).
- Mesmo visual do painel da Flush (design system copiado do puff-power-panel), em azul. Tema claro e escuro.
- React 18 + Vite + TypeScript. Testes com Vitest.
- `supabase/migrations/0001_fundacao.sql`: banco do DREND (mural, caixa de entrada, log). Ainda não aplicado.

Fase 4 (base): telas com dados de exemplo, motor do Mural com desfazer, regras de permissão.
Próximas fases ligam os dados reais (Supabase, Gmail, WhatsApp Business, bancos) e a IA.

```
npm install
npm run dev
npx vitest run
```
