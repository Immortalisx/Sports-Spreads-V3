-- Private, outcome-grounded audit only. Never expose raw vendor tables,
-- infer betting profitability, or claim a model edge from missing paired cases.
create or replace view public.sports_model_vs_market_audit
with (security_invoker=true) as
with finals as (
 select c.league,
  g.event->>'id' as game_id,
  (g.event->>'date')::date as game_date,
  (g.event->>'start')::timestamptz as game_start,
  g.event->>'homeName' as home_name,
  g.event->>'awayName' as away_name,
  (g.event->>'homeScore')::integer as home_score,
  (g.event->>'awayScore')::integer as away_score
 from public.sports_form_months c
 cross join lateral jsonb_array_elements(coalesce(c.games,'[]'::jsonb)) g(event)
 where c.league in('nba','mlb')
  and g.event->>'final'='true'
  and g.event->>'date' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
  and g.event->>'start' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'
  and g.event->>'homeScore' ~ '^[0-9]{1,3}$'
  and g.event->>'awayScore' ~ '^[0-9]{1,3}$'
  and g.event->>'homeScore'<>g.event->>'awayScore'
)
select f.league,f.game_id,f.game_date,f.recorded_at as model_as_of,
 f.model_version,f.home_probability as model_home_probability,
 o.game_start,o.home_name,o.away_name,o.home_score,o.away_score,
 case when o.home_score>o.away_score then 1 else 0 end as actual_home_win,
 power(f.home_probability-(case when o.home_score>o.away_score then 1 else 0 end),2) as model_brier,
 m.source_as_of as market_as_of,m.home_fair as market_home_probability,m.book_count,
 case when m.home_fair is not null then
  power(m.home_fair-(case when o.home_score>o.away_score then 1 else 0 end),2)
 else null end as market_brier
from public.sports_record_forecast_history f
join finals o on o.league=f.league and o.game_id=f.game_id and o.game_date=f.game_date
left join lateral (
 select hist.source_as_of,hist.home_fair,hist.book_count
 from public.sports_market_history hist
 where hist.league=f.league and hist.home_name=o.home_name and hist.away_name=o.away_name
  and hist.game_at=o.game_start
  and hist.source_as_of<=f.recorded_at
  and hist.source_as_of>=f.recorded_at-interval '90 minutes'
  and hist.source_as_of<o.game_start
 order by hist.source_as_of desc limit 1
) m on true
where f.recorded_at<o.game_start;
revoke all on public.sports_model_vs_market_audit from public,anon,authenticated;
grant select on public.sports_model_vs_market_audit to service_role,postgres;
