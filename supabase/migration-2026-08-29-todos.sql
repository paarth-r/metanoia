-- Migration 2026-08-29: daily todos on a real calendar.
-- Run in the Supabase SQL editor, after migration-2026-08-29-identity.sql.
--
-- The ledger is bound to a 30-day plan (plan_days.day is 1..30). Todos are not:
-- they run on real dates, forever, before and after any reset.
--
-- A repeating todo is ONE row plus one tick row per day it was completed. That
-- is what makes a day "refresh": a new date simply has no tick yet. No nightly
-- job, no row per day per todo, and history is never rewritten, so you can open
-- last Tuesday and tick something late without touching any other day.
--
-- Todos are private. No visibility column, no feed events: they are logistics,
-- and the ledger is the part you run in public.

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 120),
  repeats boolean not null default false,
  on_date date,      -- one-off: the date it belongs to
  starts_on date,    -- repeating: first day it appears
  ends_on date,      -- repeating: last day it appears; null runs forever
  created_at timestamptz not null default now(),
  -- Exactly one shape or the other, never a half-populated row.
  constraint todos_shape check (
    (repeats and starts_on is not null and on_date is null)
    or (not repeats and on_date is not null and starts_on is null and ends_on is null)
  )
);
create index todos_owner_idx on public.todos (owner);

create table public.todo_ticks (
  todo_id uuid not null references public.todos(id) on delete cascade,
  on_date date not null,
  updated_at timestamptz not null default now(),
  primary key (todo_id, on_date)
);

alter table public.todos enable row level security;
alter table public.todo_ticks enable row level security;

create policy todos_select on public.todos for select using (owner = auth.uid());
create policy todos_insert on public.todos for insert with check (owner = auth.uid());
create policy todos_update on public.todos for update using (owner = auth.uid());
create policy todos_delete on public.todos for delete using (owner = auth.uid());

-- Ticks inherit the todo's owner; there is nothing else to say about them.
create policy todo_ticks_select on public.todo_ticks for select
  using (exists (select 1 from public.todos t where t.id = todo_id and t.owner = auth.uid()));
create policy todo_ticks_insert on public.todo_ticks for insert
  with check (exists (select 1 from public.todos t where t.id = todo_id and t.owner = auth.uid()));
create policy todo_ticks_delete on public.todo_ticks for delete
  using (exists (select 1 from public.todos t where t.id = todo_id and t.owner = auth.uid()));

-- Dates are always sent by the client, computed in the viewer's local time.
-- current_date here is UTC: after 5pm Pacific it is already tomorrow, which
-- would file an evening todo under the wrong day.
