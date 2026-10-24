-- Resumo diário da Flush (loja Principal) para o DREND, com as MESMAS regras de
-- src/fontes/flush-regras.ts (Início do Control OS). Só SELECT: roda no projeto da Flush
-- (yglmhmcqknjqoprilhwp) e devolve uma linha com o JSON pronto para POST /api/flush.
-- Do dia 1 do mês passado até hoje, dias em Brasília, dias sem venda com zero.
with
  agora as (select (now() at time zone 'America/Sao_Paulo')::date hoje),
  dias as (
    select d::date dia
    from agora, generate_series(date_trunc('month', hoje) - interval '1 month', hoje, interval '1 day') d
  ),
  custos as (
    select lower(trim(modelo)) modelo, custo::numeric custo, ordem
    from custos_padrao where trim(coalesce(modelo, '')) <> '' and custo is not null
  ),
  vendas as (
    select s.*, (s.created_at at time zone 'America/Sao_Paulo')::date dia, lower(trim(coalesce(s.product_name, ''))) chave
    from sales s
    where s.store_id = '5f1a9c00-0000-4000-8000-000000000001'
      and s.created_at >= ((select min(dia) from dias)::timestamp at time zone 'America/Sao_Paulo')
      and s.created_at is not null
  ),
  validas as (
    select v.*,
      (case when coalesce(v.cost_price, 0) > 0 then v.cost_price::numeric
        when v.chave = '' then 0 else coalesce(
          (select c.custo from custos c where c.modelo = v.chave limit 1),
          (select c.custo from custos c where v.chave like '%' || c.modelo || '%' or c.modelo like '%' || v.chave || '%' order by c.ordem, c.modelo limit 1),
          0) end
      ) * coalesce(nullif(v.quantity, 0), 1) custo_linha
    from vendas v
    where not coalesce(v.cash_neutralized, false)
      and coalesce(v.payment_method, '') <> 'brinde'
      and v.dia not in ('2026-04-21', '2026-04-22')
  ),
  frete as (
    select (r.created_at at time zone 'America/Sao_Paulo')::date dia, sum(r.amount) pago
    from cash_register r
    where r.store_id = '5f1a9c00-0000-4000-8000-000000000001'
      and lower(r.type) = 'saida' and lower(r.reference_type) = 'sale' and r.reference_id is not null
      and r.description ~* '^\s*frete pago da venda\s*:' and r.amount > 0
      and r.created_at >= ((select min(dia) from dias)::timestamp at time zone 'America/Sao_Paulo')
      and not exists (
        select 1 from vendas v
        where v.cash_neutralized and v.order_id is not null and v.order_id::text = r.reference_id::text
          and v.dia = (r.created_at at time zone 'America/Sao_Paulo')::date)
    group by 1
  ),
  porDia as (
    select d.dia,
      round(coalesce(sum(v.final_price), 0)::numeric, 2) valor,
      round((coalesce(sum(v.final_price), 0) - coalesce(sum(v.custo_linha), 0) - coalesce(max(f.pago), 0))::numeric, 2) lucro,
      count(distinct coalesce(v.order_id::text, v.created_at::text || coalesce(v.product_name, 'null'))) pedidos
    from dias d
    left join validas v on v.dia = d.dia
    left join frete f on f.dia = d.dia
    group by d.dia
  )
select json_build_object(
  'historico', json_agg(json_build_object('dia', to_char(dia, 'YYYY-MM-DD'), 'valor', valor, 'lucro', lucro, 'pedidos', pedidos) order by dia),
  'lidoEm', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) resumo
from porDia;
