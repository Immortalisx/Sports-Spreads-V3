-- Immutable, compact market-implied consensus snapshots for future honest
-- prospective validation. Captures ONLY the existing server-side free cache.
-- No Odds API calls, quotas, browser refresh permissions or raw odds export.
create table if not exists public.sports_market_history (
 league text not null check (league in ('nfl','nba','nhl','mlb')),
 event_id text not null,
 source_as_of timestamptz not null,
 game_at timestamptz not null,
 home_name text not null,
 away_name text not null,
 home_fair numeric(8,6) not null check (home_fair>0 and home_fair<1),
 book_count integer not null check (book_count between 1 and 20),
 recorded_at timestamptz not null default now(),
 primary key (league,event_id,source_as_of)
);
create index if not exists sports_market_history_game_time_idx
 on public.sports_market_history (league,game_at);
alter table public.sports_market_history enable row level security;
revoke all on public.sports_market_history from anon,authenticated;
grant select,insert on public.sports_market_history to service_role;

create or replace function public.archive_sports_market_snapshots()
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare inserted_count integer;
begin
 with raw as (
  select c.league, e.event->>'id' as event_id,
   (c.snapshot->>'asOf')::timestamptz as source_as_of,
   (e.event->>'commence_time')::timestamptz as game_at,
   e.event->>'home_team' as home_name, e.event->>'away_team' as away_name,
   b.book->>'key' as bookmaker, m.market->'outcomes' as outcomes
  from public.sports_odds_cache c
  cross join lateral jsonb_array_elements(coalesce(c.snapshot->'events','[]'::jsonb)) e(event)
  cross join lateral jsonb_array_elements(coalesce(e.event->'bookmakers','[]'::jsonb)) b(book)
  cross join lateral jsonb_array_elements(coalesce(b.book->'markets','[]'::jsonb)) m(market)
  where m.market->>'key'='h2h'
   and b.book->>'key' in ('draftkings','fanduel','betmgm','betrivers','williamhill_us','fanatics','betparx','ballybet','espnbet')
   and c.snapshot->>'asOf' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'
   and e.event->>'commence_time' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'
   and e.event->>'id' ~ '^[a-zA-Z0-9_-]{8,80}$'
 ), price as (
  select r.*,
   (select (o.obj->>'price')::numeric from jsonb_array_elements(coalesce(r.outcomes,'[]'::jsonb)) o(obj)
    where o.obj->>'name'=r.home_name and o.obj->>'price' ~ '^-?[0-9]{3,6}$' limit 1) as hp,
   (select (o.obj->>'price')::numeric from jsonb_array_elements(coalesce(r.outcomes,'[]'::jsonb)) o(obj)
    where o.obj->>'name'=r.away_name and o.obj->>'price' ~ '^-?[0-9]{3,6}$' limit 1) as ap
  from raw r
 ), implied as (
  select p.*,
   case when hp>=100 then 100/(hp+100) when hp<=-100 then -hp/(-hp+100) else null end as h,
   case when ap>=100 then 100/(ap+100) when ap<=-100 then -ap/(-ap+100) else null end as a
  from price p
 ), aggregated as (
  select league,event_id,source_as_of,game_at,home_name,away_name,
   round(avg(h/(h+a)),6) as home_fair,count(distinct bookmaker)::integer as book_count
  from implied where h is not null and a is not null and h+a>0
  group by league,event_id,source_as_of,game_at,home_name,away_name
 ), inserted as (
  insert into public.sports_market_history(league,event_id,source_as_of,game_at,home_name,away_name,home_fair,book_count)
  select league,event_id,source_as_of,game_at,home_name,away_name,home_fair,book_count
  from aggregated
  on conflict do nothing
  returning 1
 )
 select count(*) into inserted_count from inserted;
 return inserted_count;
end;
$function$;
revoke all on function public.archive_sports_market_snapshots() from public,anon,authenticated;
grant execute on function public.archive_sports_market_snapshots() to service_role,postgres;

-- Capture after each of the existing 17:00 / 23:00 UTC cache refreshes.
select cron.schedule('sports-spreads-prospective-market-archive','9 17,23 * * *',
 $$select public.archive_sports_market_snapshots();$$);