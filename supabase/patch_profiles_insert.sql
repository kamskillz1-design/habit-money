-- Run once in the Supabase SQL editor if onboarding step 1 fails with "Algo salió mal".
-- Lets the client create public.profiles when the signup trigger did not run.

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
