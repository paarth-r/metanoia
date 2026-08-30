-- Migration 2026-08-30: account deletion, blocking, reporting, moderation.
-- Run in the Supabase SQL editor, after the 2026-08-29 migrations.
--
-- This exists to satisfy two App Store requirements that are not optional:
--   5.1.1(v) - an app that lets you create an account must let you DELETE it
--              in the app.
--   1.2      - an app carrying user-generated content (group chat, public
--              ledgers) must filter objectionable material, let people report
--              it, let people block abusive users, and publish contact info.
-- All of it is enforced here in RLS rather than in the clients, so a blocked
-- user genuinely cannot reach you even through the REST API.

-- ---------- account deletion ----------
-- No edge function and no service_role key in the app: a security-definer
-- function owned by postgres may delete from auth.users, and every table
-- cascades from there (profiles -> plans -> plan_days/weeks, todos, groups,
-- friendships, feed_events, messages). Deletion is real, not a deactivation.

create or replace function public.delete_me()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- ---------- admin + suspension ----------

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists suspended boolean not null default false;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = uid), false);
$$;

create or replace function public.is_suspended(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from profiles where id = uid), false);
$$;

-- Nobody may hand themselves the admin bit or lift their own suspension: the
-- profiles update grant is column-scoped.
revoke update on table public.profiles from authenticated;
grant update (username, display_name) on table public.profiles to authenticated;

-- ---------- blocking ----------

create table public.blocks (
  blocker uuid not null references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint blocks_not_self check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

alter table public.blocks enable row level security;
create policy blocks_select on public.blocks for select using (blocker = auth.uid());
create policy blocks_insert on public.blocks for insert with check (blocker = auth.uid());
create policy blocks_delete on public.blocks for delete using (blocker = auth.uid());

-- Blocking is symmetric in effect: neither side sees the other's content, so
-- blocking someone cannot be used to keep watching them one-way.
create or replace function public.blocked_between(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select u1 is not null and u2 is not null and exists (
    select 1 from blocks
    where (blocker = u1 and blocked = u2) or (blocker = u2 and blocked = u1)
  );
$$;

-- ---------- reports ----------

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles(id) on delete cascade,
  target_user uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('message', 'profile', 'plan')),
  message_id bigint references public.group_messages(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert
  with check (reporter = auth.uid());
create policy reports_select on public.reports for select
  using (reporter = auth.uid() or public.is_admin(auth.uid()));
create policy reports_update on public.reports for update
  using (public.is_admin(auth.uid()));

-- ---------- content filter ----------
-- The mechanism Apple asks for: matched terms are refused at write time, in the
-- database, so no client can post around it. Seeded lightly on purpose - extend
-- it from the admin page as real abuse shows up, since an over-broad list
-- silently eats legitimate messages.

create table public.banned_terms (
  term text primary key,
  added_at timestamptz not null default now()
);
alter table public.banned_terms enable row level security;
create policy bt_select on public.banned_terms for select using (true);
create policy bt_write on public.banned_terms for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

insert into public.banned_terms (term) values
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('whore'), ('rape'), ('nigger'), ('faggot')
  on conflict do nothing;

-- Word-boundary match on a normalised copy, so "Scunthorpe" and "classic" are
-- not casualties of a naive substring test.
create or replace function public.contains_banned(txt text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from banned_terms
    where lower(txt) ~ ('(^|[^a-z])' || term || '([^a-z]|$)')
  );
$$;

create or replace function public.guard_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_suspended(new.user_id) then
    raise exception 'This account is suspended.';
  end if;
  if public.contains_banned(new.body) then
    raise exception 'That message breaks the community rules.';
  end if;
  return new;
end $$;

drop trigger if exists guard_message_insert on public.group_messages;
create trigger guard_message_insert before insert on public.group_messages
  for each row execute function public.guard_message();

-- ---------- enforcement: blocked and suspended users disappear ----------

-- can_view already gates every plan, plan_day and plan_week policy, so denying
-- it here hides a blocked user's whole ledger everywhere at once.
create or replace function public.can_view(viewer uuid, plan_owner uuid, vis text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.blocked_between(viewer, plan_owner) then false
    when public.is_suspended(plan_owner) and viewer is distinct from plan_owner then false
    else vis = 'public'
      or viewer = plan_owner
      or (vis = 'friends' and viewer is not null
          and (public.are_friends(viewer, plan_owner) or public.share_group(viewer, plan_owner)))
  end;
$$;

drop policy if exists feed_select on public.feed_events;
create policy feed_select on public.feed_events for select
  using (
    user_id = auth.uid()
    or (not public.blocked_between(auth.uid(), user_id)
        and not public.is_suspended(user_id)
        and plan_id is not null
        and exists (select 1 from public.plans p where p.id = plan_id
                    and public.can_view(auth.uid(), p.owner, p.visibility)))
  );

drop policy if exists gm_select on public.group_messages;
create policy gm_select on public.group_messages for select
  using (public.is_group_member(group_id, auth.uid())
         and not public.blocked_between(auth.uid(), user_id));

-- An admin may remove a reported message.
create policy gm_delete_admin on public.group_messages for delete
  using (public.is_admin(auth.uid()));

-- Suspended accounts cannot broadcast.
drop policy if exists feed_insert on public.feed_events;
create policy feed_insert on public.feed_events for insert
  with check (auth.uid() = user_id and not public.is_suspended(auth.uid()));

-- ---------- moderation actions (admin only) ----------

create or replace function public.set_suspended(target uuid, val boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not an admin'; end if;
  update profiles set suspended = val where id = target;
end $$;
revoke all on function public.set_suspended(uuid, boolean) from public, anon;
grant execute on function public.set_suspended(uuid, boolean) to authenticated;
