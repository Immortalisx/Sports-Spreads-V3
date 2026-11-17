-- Point-in-time, current-season opponent-adjusted research snapshots.
-- No API keys or bookmaker credits; ESPN monthly source fetched only by private cron POST.
-- Underlying tables have RLS with NO anon/authenticated read/write policies.
create table if not exists public.sports_form_months(
 league text not null check(league in ('nfl','nba','nhl','mlb')),
 year_month text not null check(year_month ~ '^20[0-9]{4}$'),
 games jsonb not null default '[]'::jsonb,
 fetched_at timestamptz not null default now(),
 primary key(league,year_month)
);
create table if not exists public.sports_form_latest(
 league text primary key check(league in ('nfl','nba','nhl','mlb')),
 season text not null,
 snapshot jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.sports_form_months enable row level security;
alter table public.sports_form_latest enable row level security;
revoke all on public.sports_form_months from anon,authenticated;
revoke all on public.sports_form_latest from anon,authenticated;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- One shared refresh per sport at 17:25 UTC. Skip out-of-season sports.
-- The Vault token authorizes POST and never leaves the database/server.
select cron.schedule('sports-spreads-current-season-form',
 '25 17 * * *',
 $refresh$
 select net.http_post(
  url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/season-form?league='||league,
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-refresh-token',(select decrypted_secret from vault.decrypted_secrets
    where name='sports_spreads_odds_refresh_v1' limit 1)),
  timeout_milliseconds:=18000
 )
 from (values ('nfl'),('nba'),('nhl'),('mlb')) as sports(league)
 where
  (league='nfl' and (extract(month from now())>=9 or extract(month from now())<=2)) or
  (league='nba' and (extract(month from now())>=10 or extract(month from now())<=6)) or
  (league='nhl' and (extract(month from now())>=10 or extract(month from now())<=6)) or
  (league='mlb' and (extract(month from now()) between 3 and 10));
 $refresh$);
