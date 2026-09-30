-- Préférences partenaire pour la page « Commandes Organisateurs » :
-- saisons archivées + dettes marquées soldées auprès des organismes.
alter table public.collectivities
  add column if not exists organizer_amounts_prefs jsonb not null default '{}'::jsonb;

comment on column public.collectivities.organizer_amounts_prefs is
  'Prefs UI montants organisateurs : { archivedSeasonIds: string[], settlements: [{ organizerId, seasonId, year, settledAt }] }.';
