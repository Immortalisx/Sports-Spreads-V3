-- Immutable forward-looking predictions for NBA/MLB record-only models.
-- Never claim player, coaching or NFL/NHL calibration from these numbers.
create table if not exists public.sports_record_forecast_history (
 league text not null check (league in ('nba','mlb')),
 game_id text not null check (game_id ~ '^[0-9]{6,15}$'),
 game_date date not null,
 home_team_id text not null,
 away_team_id text not null,
 home_probability numeric(8,6) not null check (home_probability>0 and home_probability<1),
 home_wins integer not null,
 home_played integer not null,
 away_wins integer not null,
 away_played integer not null,
 source_generated_at timestamptz not null,
 model_version text not null check (model_version='record-holdout-2025-v1'),
 recorded_at timestamptz not null default now(),
 primary key (league,game_id,game_date)
);
create index if not exists sports_record_forecast_date_idx
 on public.sports_record_forecast_history (game_date,league);
alter table public.sports_record_forecast_history enable row level security;
revoke all on public.sports_record_forecast_history from anon,authenticated;
grant select,insert on public.sports_record_forecast_history to service_role;

create or replace function public.archive_sports_record_model_snapshots()
returns integer language plpgsql security invoker set search_path='' as $function$
declare n integer;
begin
 with inputs as (
  select c.league,s.game,
    s.game->>'gameId' as game_id,
    (s.game->>'date')::date as game_date,
    s.game->>'homeTeamId' as home_team_id,
    s.game->>'awayTeamId' as away_team_id,
    (s.game#>>'{home,wins}')::integer as hw,
    (s.game#>>'{home,played}')::integer as hp,
    (s.game#>>'{away,wins}')::integer as aw,
    (s.game#>>'{away,played}')::integer as ap,
    (c.snapshot->>'generatedAt')::timestamptz as generated_at,
    case when c.league='nba' then 20::numeric else 32::numeric end as prior,
    case when c.league='nba' then 0.2787507901099391::numeric else 0.10807274819406::numeric end as intercept,
    case when c.league='nba' then 1.1682948273637834::numeric else 0.8220924935092405::numeric end as slope,
    case when c.league='nba' then -0.10803372226630314::numeric else -0.005230791554107961::numeric end as cal_intercept,
    case when c.league='nba' then 1.1376763909614487::numeric else 0.8776684524659046::numeric end as cal_slope
  from public.sports_form_latest c
  cross join lateral jsonb_array_elements(coalesce(c.snapshot->'snapshots','[]'::jsonb)) s(game)
  where c.league in ('nba','mlb')
   and c.snapshot->>'generatedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'
   and s.game->>'date' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   and s.game->>'gameId' ~ '^[0-9]{6,15}$'
   and s.game->>'homeTeamId' ~ '^[0-9]{1,15}$'
   and s.game->>'awayTeamId' ~ '^[0-9]{1,15}$'
   and s.game#>>'{home,wins}' ~ '^[0-9]{1,3}$'
   and s.game#>>'{home,played}' ~ '^[0-9]{1,3}$'
   and s.game#>>'{away,wins}' ~ '^[0-9]{1,3}$'
   and s.game#>>'{away,played}' ~ '^[0-9]{1,3}$'
   and s.game->>'appliedToForecast' = 'false'
   and s.game->>'calibrated' = 'false'
   and s.game#>>'{evidence,dateCutoff}' = 'strictly before game calendar date'
 ), eligible as (
  select *,
   ln((hw+prior/2)/(hp-hw+prior/2)) as home_logit,
   ln((aw+prior/2)/(ap-aw+prior/2)) as away_logit
  from inputs
  where game_date > (now() at time zone 'America/New_York')::date
   and generated_at<=now()
   and generated_at::date<=game_date
   and hw<=hp and aw<=ap and hp between 1 and 200 and ap between 1 and 200
 ), predictions as (
  select *,
   1/(1+exp(-(cal_intercept+cal_slope*(intercept+slope*(home_logit-away_logit))))) as p
  from eligible
 ), inserted as (
  insert into public.sports_record_forecast_history(
   league,game_id,game_date,home_team_id,away_team_id,home_probability,
   home_wins,home_played,away_wins,away_played,source_generated_at,model_version
  )
  select league,game_id,game_date,home_team_id,away_team_id,
    round(p,6),hw,hp,aw,ap,generated_at,'record-holdout-2025-v1'
  from predictions
  on conflict do nothing
  returning 1
 )
 select count(*) into n from inserted;
 return n;
end $function$;
revoke all on function public.archive_sports_record_model_snapshots() from public,anon,authenticated;
grant execute on function public.archive_sports_record_model_snapshots() to service_role,postgres;

-- Archive only tomorrow-and-later fixtures, after the protected form refresh.
-- No visitor requests, odds API calls or background Render instance.
select cron.schedule('sports-spreads-future-record-predictions','45 17 * * *',
 $$select public.archive_sports_record_model_snapshots();$$);