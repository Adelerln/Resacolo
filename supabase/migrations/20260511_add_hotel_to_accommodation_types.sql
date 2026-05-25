begin;

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
      'hotel',
      'camping',
      'famille d''accueil',
      'gite',
      'mixte'
    ]::text[]
  )
);

commit;
