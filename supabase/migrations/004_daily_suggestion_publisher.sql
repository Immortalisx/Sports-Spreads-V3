-- Daily ticket research snapshots. Visitors read ONLY via a public Edge GET
-- that uses the service role internally. No public table permissions.
create table if not exists public.sports_daily_tickets(
 date_et date primary key,
 snapshot jsonb not null,
 generated_at timestamptz not null default now()
);
alter table public.sports_daily_tickets enable row level security;
revoke all on public.sports_daily_tickets from anon,authenticated;
-- Schedule at 17:15 UTC, after 17:00 UTC seasonal odds refresh.
-- Authentication uses existing Vault 'sports_spreads_odds_refresh_v1'; never expose it to the browser.
select cron.schedule('sports-spreads-daily-suggestions',
 '15 17 * * *',
 $daily$
 select net.http_post(
  url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/daily-tickets',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-refresh-token',(select decrypted_secret from vault.decrypted_secrets where name='sports_spreads_odds_refresh_v1' limit 1)),
  timeout_milliseconds:=18000
 );
 $daily$);
