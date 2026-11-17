-- Sports Spreads: server-only, $0-tier-friendly sportsbook odds cache and strict monthly API quota.
-- No odds API key is stored here; it resides in a Supabase Edge Functions secret.
create table if not exists public.sports_odds_cache (
 league text primary key check (league in ('nfl','nba','nhl','mlb')),
 snapshot jsonb not null,
 fetched_at timestamptz not null default now()
);
alter table public.sports_odds_cache enable row level security;
revoke all on public.sports_odds_cache from anon, authenticated;

create table if not exists public.sports_odds_api_budget (
 period text primary key check (period ~ '^[0-9]{4}-[0-9]{2}$'),
 reserved integer not null default 0 check (reserved >= 0),
 updated_at timestamptz not null default now()
);
alter table public.sports_odds_api_budget enable row level security;
revoke all on public.sports_odds_api_budget from anon, authenticated;

create or replace function public.reserve_sports_odds_credit(p_period text, p_cost integer, p_ceiling integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v_reserved integer;
begin
 if p_period !~ '^[0-9]{4}-[0-9]{2}$' or p_cost <> 1 or p_ceiling > 400 or p_ceiling < 1
 then raise exception 'Invalid quota request'; end if;
 insert into public.sports_odds_api_budget(period,reserved) values(p_period,0) on conflict(period) do nothing;
 update public.sports_odds_api_budget
 set reserved = reserved + p_cost, updated_at = now()
 where period = p_period and reserved + p_cost <= p_ceiling
 returning reserved into v_reserved;
 return v_reserved; -- NULL means hard-cap reached, and no provider request should be made.
end;
$$;
revoke all on function public.reserve_sports_odds_credit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.reserve_sports_odds_credit(text,integer,integer) to service_role;
