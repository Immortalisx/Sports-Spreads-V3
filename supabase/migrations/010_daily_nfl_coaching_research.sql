-- NFL coaching research is a server-only derived cache, not a public
-- provider database. Daily free-source ingestion is limited to football season.
create table if not exists public.sports_coaching_latest (
 id integer primary key check (id=1),
 snapshot jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.sports_coaching_latest enable row level security;
revoke all on public.sports_coaching_latest from anon, authenticated;
grant select,insert,update on public.sports_coaching_latest to service_role;

-- Reuse the already-Vaulted, owner-only refresh credential. No visitor can
-- reach the upstream CSV or invoke POST without the private stored token.
select cron.schedule(
 'sports-spreads-nfl-coaching',
 '5 18 * * *',
 $schedule$
 select net.http_post(
  url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nfl-coaching',
  body:='{}'::jsonb,
  headers:=jsonb_build_object(
   'content-type','application/json',
   'x-refresh-token',
   (select decrypted_secret from vault.decrypted_secrets
    where name='sports_spreads_odds_refresh_v1' limit 1)
  )
 )
 where extract(month from now() at time zone 'America/New_York') in (1,2,8,9,10,11,12);
 $schedule$
);