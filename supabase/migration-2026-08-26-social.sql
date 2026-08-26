-- APPLIED 2026-08-26 (with the is_group_member recursion fix from schema.sql).
-- Migration 2026-08-26: group chat, group images, feed reactions.
-- Run in the Supabase SQL editor. Idempotent-ish: safe on a fresh project
-- after schema.sql; on re-run, drop the objects first.

alter table public.groups add column if not exists image_url text;

create table public.group_messages (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

create table public.feed_reactions (
  event_id bigint not null references public.feed_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('respect', 'locked_in', 'soft')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.group_messages enable row level security;
alter table public.feed_reactions enable row level security;

create policy gm_select on public.group_messages for select
  using (public.is_group_member(group_id, auth.uid()));
create policy gm_insert on public.group_messages for insert
  with check (user_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy gm_delete on public.group_messages for delete
  using (user_id = auth.uid());

create policy fr_select on public.feed_reactions for select
  using (exists (select 1 from public.feed_events fe where fe.id = event_id));
create policy fr_insert on public.feed_reactions for insert
  with check (user_id = auth.uid() and exists
              (select 1 from public.feed_events fe where fe.id = event_id));
create policy fr_update on public.feed_reactions for update
  using (user_id = auth.uid());
create policy fr_delete on public.feed_reactions for delete
  using (user_id = auth.uid());

-- any member may update their group (name, image)
create policy groups_update_members on public.groups for update
  using (public.is_group_member(id, auth.uid()));

alter publication supabase_realtime add table public.group_messages;

-- storage bucket for group images
insert into storage.buckets (id, name, public) values ('group-images', 'group-images', true)
  on conflict do nothing;
create policy gi_read on storage.objects for select
  using (bucket_id = 'group-images');
create policy gi_insert on storage.objects for insert
  with check (bucket_id = 'group-images' and auth.role() = 'authenticated');
create policy gi_update on storage.objects for update
  using (bucket_id = 'group-images' and auth.role() = 'authenticated');
