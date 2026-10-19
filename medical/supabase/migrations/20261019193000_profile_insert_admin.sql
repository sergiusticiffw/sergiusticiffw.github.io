-- Only a family admin can add a profile. Editors keep update access.

drop policy if exists profiles_editor_insert on public.profiles;
