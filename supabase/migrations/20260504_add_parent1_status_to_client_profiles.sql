alter table public.client_profiles
  add column if not exists parent1_status text not null default 'pere',
  add column if not exists parent1_status_other text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_profiles_parent1_status_check'
  ) then
    alter table public.client_profiles
      add constraint client_profiles_parent1_status_check
      check (parent1_status in ('pere', 'mere', 'grand-parent', 'autre'));
  end if;
end
$$;
