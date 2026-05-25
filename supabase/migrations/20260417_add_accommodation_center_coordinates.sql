begin;

alter table public.accommodations
add column if not exists center_latitude double precision null,
add column if not exists center_longitude double precision null;

alter table public.accommodations
drop constraint if exists accommodations_center_latitude_range_check;

alter table public.accommodations
add constraint accommodations_center_latitude_range_check
check (
  center_latitude is null
  or (center_latitude >= -90 and center_latitude <= 90)
);

alter table public.accommodations
drop constraint if exists accommodations_center_longitude_range_check;

alter table public.accommodations
add constraint accommodations_center_longitude_range_check
check (
  center_longitude is null
  or (center_longitude >= -180 and center_longitude <= 180)
);

alter table public.accommodations
drop constraint if exists accommodations_center_coordinates_pair_check;

alter table public.accommodations
add constraint accommodations_center_coordinates_pair_check
check (
  (center_latitude is null and center_longitude is null)
  or (center_latitude is not null and center_longitude is not null)
);

comment on column public.accommodations.center_latitude is
'Latitude du centre (interne), utilisée pour la carte publique approximative.';

comment on column public.accommodations.center_longitude is
'Longitude du centre (interne), utilisée pour la carte publique approximative.';

commit;
