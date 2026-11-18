-- Single read-only cached NFL availability snapshot. Server-only refresh, RLS on.
create table if not exists public.sports_nfl_availability_latest (
 id int primary key check(id=1),
 snapshot jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.sports_nfl_availability_latest enable row level security;
revoke all on public.sports_nfl_availability_latest from anon,authenticated;
-- Owner-only daily refresh. Vault token same already used by sports-form and odds.
select cron.schedule('sports-spreads-nfl-availability',
 '45 17 * * *',
 $availability$
 select net.http_post(
  url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nfl-availability',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-refresh-token',(select decrypted_secret from vault.decrypted_secrets
     where name='sports_spreads_odds_refresh_v1' limit 1)),
  timeout_milliseconds:=45000
 ) where extract(month from now()) in (9,10,11,12,1,2);
 $availability$);
