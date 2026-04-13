begin;

alter table public.accommodations
add column if not exists accommodation_types text[] null;

update public.accommodations
set accommodation_types = case
  when accommodation_type is null or btrim(accommodation_type) = '' then null
  else array[accommodation_type]
end
where accommodation_types is null;

alter table public.accommodations
drop constraint if exists accommodations_accommodation_types_allowed_check;

alter table public.accommodations
add constraint accommodations_accommodation_types_allowed_check
check (
  accommodation_types is null
  or (
    cardinality(accommodation_types) >= 1
    and accommodation_types <@ array[
      'centre',
      'auberge de jeunesse',
      'camping',
      'famille d''accueil',
      'gite',
      'mixte'
    ]::text[]
  )
);

comment on column public.accommodations.accommodation_types is
'Liste des types d''hébergement. Utiliser un seul type par défaut, plusieurs uniquement pour les hébergements itinérants.';

commit;
