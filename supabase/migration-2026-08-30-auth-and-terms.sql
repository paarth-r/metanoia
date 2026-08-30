-- Migration 2026-08-30b: run AFTER migration-2026-08-30-safety.sql.
-- Two small follow-ups. Safe to run once; both statements are idempotent.

-- 1. The banned list does not need to be world-readable. contains_banned() is
-- security definer and reads the table regardless of RLS, and no client ever
-- queries it, so serving the list to anyone holding the anon key was pointless.
drop policy if exists bt_select on public.banned_terms;
create policy bt_select on public.banned_terms for select
  using (public.is_admin(auth.uid()));

-- 2. Nothing else is needed here for dropping email confirmation: that is a
-- dashboard setting, not schema. See the note in README.
--    Authentication -> Sign In / Providers -> Email -> Confirm email: OFF
