alter table public.organizers
add column if not exists season_keys text[] not null default '{}',
add column if not exists stay_type_keys text[] not null default '{}',
add column if not exists activity_keys text[] not null default '{}';

comment on column public.organizers.season_keys is
  'Saisons mises en avant par l’organisateur sur sa page publique.';

comment on column public.organizers.stay_type_keys is
  'Types de séjours proposés par l’organisateur.';

comment on column public.organizers.activity_keys is
  'Activités proposées par l’organisateur.';
