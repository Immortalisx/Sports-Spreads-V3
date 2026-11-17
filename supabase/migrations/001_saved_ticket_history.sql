-- Sports Spreads v2.2 optional cloud ticket history.
-- Apply ONLY after a dedicated Supabase project exists. Never expose a service-role key.
-- The table stores users' own manually-entered odds. These are not official model outputs.
create table if not exists public.user_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default (select auth.uid()) references auth.users(id) on delete cascade,
  label text not null default 'Saved ticket' check(length(label) between 1 and 95),
  stake numeric(14,2) not null check(stake > 0 and stake <= 1000000),
  legs jsonb not null check(jsonb_typeof(legs)='array' and jsonb_array_length(legs) between 1 and 20),
  combined_american_odds text not null,
  potential_return numeric(16,2) not null check(potential_return >= 0),
  odds_source text not null default 'manual_unverified' check(odds_source='manual_unverified'),
  created_at timestamptz not null default now()
);
create index if not exists user_tickets_user_date_idx on public.user_tickets(user_id,created_at desc);
alter table public.user_tickets enable row level security;
revoke all on public.user_tickets from anon,authenticated;
grant select,insert on public.user_tickets to authenticated;
-- Saved snapshots are append-only. No UPDATE or DELETE grants for authenticated users.
create policy "Read personal ticket snapshots" on public.user_tickets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert personal ticket snapshots" on public.user_tickets
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- Once your model is connected, store official model snapshots in a separate
-- server-writable, audited schema. Never trust client-supplied 'confidence'.