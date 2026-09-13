-- Autoriser un statut parental vide (non renseigné) sur le profil famille

alter table public.client_profiles
  drop constraint if exists client_profiles_parent1_status_check;

alter table public.client_profiles
  add constraint client_profiles_parent1_status_check
  check (parent1_status in ('pere', 'mere', 'grand-parent', 'autre', ''));

alter table public.client_profiles
  drop constraint if exists client_profiles_parent2_status_check;

alter table public.client_profiles
  add constraint client_profiles_parent2_status_check
  check (parent2_status in ('pere', 'mere', 'grand-parent', 'autre', ''));

alter table public.client_profiles
  alter column parent1_status set default '';

alter table public.client_profiles
  alter column parent2_status set default '';
