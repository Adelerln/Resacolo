-- Durées min / max de séjour (en jours) saisies par l'organisateur pour la fiche publique.
alter table public.organizers
  add column if not exists stay_duration_min_days integer,
  add column if not exists stay_duration_max_days integer;

comment on column public.organizers.stay_duration_min_days is 'Durée minimale typique des séjours proposés (jours), affichée sur la fiche organisateur.';
comment on column public.organizers.stay_duration_max_days is 'Durée maximale typique des séjours proposés (jours), affichée sur la fiche organisateur.';
