-- Migration 2026-08-29: identity is claimed at signup, not discovered later.
-- Run in the Supabase SQL editor.
--
-- Before this, handle_new_user() inserted a profile row with only an id, so
-- every new account was username NULL / display_name '' until the person found
-- the Account page. Everywhere else in both clients that reads as "unnamed" or
-- "?", and their profile link (#/u/<username>) is a dead end. Now both clients
-- collect a username and display name on the signup form and pass them as auth
-- metadata; this trigger writes them into the profile as the account is created.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  want_u text := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  want_d text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
begin
  -- Trust nothing from the client: the same shape the column check enforces.
  if want_u is not null and want_u !~ '^[a-z0-9_]{3,20}$' then
    want_u := null;
  end if;

  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, want_u, coalesce(want_d, ''))
    on conflict (id) do nothing;
  exception when unique_violation then
    -- The name was taken between the client's availability check and this
    -- insert. Never fail the signup over it: create the profile without a
    -- username and let the clients' claim gate ask for another one.
    insert into public.profiles (id, username, display_name)
    values (new.id, null, coalesce(want_d, ''))
    on conflict (id) do nothing;
  end;

  return new;
end $$;
