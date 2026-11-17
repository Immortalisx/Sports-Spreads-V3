-- Free-tier odds refresh: twice daily, seasonal-only, server-side; no visitor can spend API credits.
-- Dependencies: public.sports_odds_cache, public.sports_odds_api_budget, and reserve_sports_odds_credit.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
begin
 if not exists (select 1 from vault.secrets where name='sports_spreads_odds_refresh_v1') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
   'sports_spreads_odds_refresh_v1','Private server-side Sports Spreads refresh credential');
 end if;
end $$;
create or replace function public.verify_sports_odds_refresh_token(p_token text)
returns boolean language sql security definer set search_path='' as $fn$
 select length(coalesce(p_token,''))>=64 and exists (
  select 1 from vault.decrypted_secrets
  where name='sports_spreads_odds_refresh_v1' and decrypted_secret=p_token);
$fn$;
revoke all on function public.verify_sports_odds_refresh_token(text) from public,anon,authenticated;
grant execute on function public.verify_sports_odds_refresh_token(text) to service_role;

-- Per-month API hard ceiling enforced in Edge Function via DB RPC: 400 <= free 500 credits.
select cron.schedule('sports-spreads-cached-odds-2x-daily','0 17,23 * * *',$job$
select net.http_post(
 url:='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/sportsbook-odds?league=' || leagues.league,
 body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json',
  'x-refresh-token',(select decrypted_secret from vault.decrypted_secrets where name='sports_spreads_odds_refresh_v1' limit 1)),
 timeout_milliseconds:=18000
)
from (values ('nfl'),('nba'),('nhl'),('mlb')) as leagues(league)
where
 (league='nfl' and (extract(month from now())>=9 or extract(month from now())<=2)) or
 (league='nba' and (extract(month from now())>=10 or extract(month from now())<=6)) or
 (league='nhl' and (extract(month from now())>=10 or extract(month from now())<=6)) or
 (league='mlb' and (extract(month from now()) between 3 and 10));
$job$);
