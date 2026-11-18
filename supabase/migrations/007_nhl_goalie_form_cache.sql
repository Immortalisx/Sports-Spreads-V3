-- NHL goalie form: single server-managed research cache. No public table access.
create table if not exists public.sports_nhl_goalie_latest (
 id int primary key check(id=1),
 snapshot jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.sports_nhl_goalie_latest enable row level security;
revoke all on public.sports_nhl_goalie_latest from anon,authenticated;
-- One shared refresh daily during hockey season (UTC 17:35, late morning/noon ET).
-- Uses existing private Vault-backed token and internal Edge Function.
select cron.schedule('sports-spreads-nhl-goalie-form','35 17 * * *',
 $goalies$
 select net.http_post(
  url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nhl-goalie-form',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-refresh-token',(select decrypted_secret from vault.decrypted_secrets
    where name='sports_spreads_odds_refresh_v1' limit 1)),
  timeout_milliseconds:=90000
 ) where extract(month from now()) >= 10 or extract(month from now()) <= 6;
 $goalies$);
