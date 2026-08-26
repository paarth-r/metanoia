-- Metanoia schema. Run this once in the Supabase SQL editor of a fresh project.
-- Privacy model: every plan is 'private' (owner only), 'friends' (accepted
-- friends and group-mates), or 'public' (anyone, signed in or not).
-- All enforcement lives here in row-level security, not in the client.

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- plans ----------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My Reset',
  intent text not null default '',
  start_date date not null,
  habits jsonb not null,                 -- ["habit label", ...] (3-7)
  targets jsonb not null default '[]',   -- [["Lift", 3], ...]
  week_meta jsonb,                       -- optional per-week social/reading
  visibility text not null default 'friends'
    check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now()
);
create index plans_owner_idx on public.plans (owner);

create table public.plan_days (
  plan_id uuid not null references public.plans(id) on delete cascade,
  day int not null check (day between 1 and 30),
  checks jsonb not null,                 -- [true, false, ...]
  updated_at timestamptz not null default now(),
  primary key (plan_id, day)
);

create table public.plan_weeks (
  plan_id uuid not null references public.plans(id) on delete cascade,
  week int not null check (week between 1 and 4),
  checks jsonb not null,                 -- {"0": [true,false], ...} by target index
  updated_at timestamptz not null default now(),
  primary key (plan_id, week)
);

-- ---------- friends ----------
-- One row per pair, normalized so user_a < user_b.

create table public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- ---------- groups ----------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid not null references public.profiles(id) on delete cascade,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------- feed ----------

create table public.feed_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  kind text not null check (kind in ('started', 'tick', 'perfect', 'streak', 'finished')),
  day int,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index feed_events_user_idx on public.feed_events (user_id, created_at desc);
create index feed_events_created_idx on public.feed_events (created_at desc);

-- ---------- helper functions ----------

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = uid);
$$;

create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_a = least(u1, u2) and user_b = greatest(u1, u2) and status = 'accepted'
  );
$$;

create or replace function public.share_group(u1 uuid, u2 uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members g1
    join group_members g2 using (group_id)
    where g1.user_id = u1 and g2.user_id = u2
  );
$$;

create or replace function public.can_view(viewer uuid, plan_owner uuid, vis text)
returns boolean language sql stable security definer set search_path = public as $$
  select vis = 'public'
      or viewer = plan_owner
      or (vis = 'friends' and viewer is not null
          and (public.are_friends(viewer, plan_owner) or public.share_group(viewer, plan_owner)));
$$;

-- Join a group by invite code (bypasses RLS to find the group, then adds the caller).
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select id into gid from groups where invite_code = lower(code);
  if gid is null then raise exception 'no group with that invite code'; end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid())
    on conflict do nothing;
  return gid;
end $$;

-- ---------- row-level security ----------

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.feed_events enable row level security;

-- profiles: public directory; only you edit yours.
create policy profiles_select on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- plans
create policy plans_select on public.plans for select
  using (public.can_view(auth.uid(), owner, visibility));
create policy plans_insert on public.plans for insert
  with check (auth.uid() = owner);
create policy plans_update on public.plans for update
  using (auth.uid() = owner);
create policy plans_delete on public.plans for delete
  using (auth.uid() = owner);

-- plan_days / plan_weeks inherit the plan's visibility
create policy plan_days_select on public.plan_days for select
  using (exists (select 1 from public.plans p where p.id = plan_id
                 and public.can_view(auth.uid(), p.owner, p.visibility)));
create policy plan_days_write on public.plan_days for insert
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner = auth.uid()));
create policy plan_days_update on public.plan_days for update
  using (exists (select 1 from public.plans p where p.id = plan_id and p.owner = auth.uid()));

create policy plan_weeks_select on public.plan_weeks for select
  using (exists (select 1 from public.plans p where p.id = plan_id
                 and public.can_view(auth.uid(), p.owner, p.visibility)));
create policy plan_weeks_write on public.plan_weeks for insert
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner = auth.uid()));
create policy plan_weeks_update on public.plan_weeks for update
  using (exists (select 1 from public.plans p where p.id = plan_id and p.owner = auth.uid()));

-- friendships: you see rows you are part of; you can request, the other side accepts.
create policy friendships_select on public.friendships for select
  using (auth.uid() in (user_a, user_b));
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() = requested_by and auth.uid() in (user_a, user_b) and status = 'pending');
create policy friendships_update on public.friendships for update
  using (auth.uid() in (user_a, user_b) and auth.uid() <> requested_by);
create policy friendships_delete on public.friendships for delete
  using (auth.uid() in (user_a, user_b));

-- groups: members see their groups; anyone signed in can create one.
create policy groups_select on public.groups for select
  using (owner = auth.uid() or public.is_group_member(id, auth.uid()));
create policy groups_insert on public.groups for insert
  with check (auth.uid() = owner);
create policy groups_delete on public.groups for delete
  using (auth.uid() = owner);

-- NOTE: must go through the security-definer helper; a subquery on
-- group_members inside its own policy is infinite recursion (42P17).
create policy group_members_select on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));
create policy group_members_delete on public.group_members for delete
  using (user_id = auth.uid());
-- inserts happen through join_group() or group creation (security definer)

create or replace function public.create_group(gname text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  insert into groups (name, owner) values (gname, auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

-- feed: you write your own events; readers see events whose plan they can view.
create policy feed_insert on public.feed_events for insert
  with check (auth.uid() = user_id);
create policy feed_select on public.feed_events for select
  using (
    user_id = auth.uid()
    or (plan_id is not null and exists
        (select 1 from public.plans p where p.id = plan_id
         and public.can_view(auth.uid(), p.owner, p.visibility)))
  );
create policy feed_delete on public.feed_events for delete
  using (auth.uid() = user_id);

-- ---------- realtime ----------

alter publication supabase_realtime add table public.feed_events;
