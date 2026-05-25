alter table public.collectivities
  add column if not exists logo_scale double precision not null default 1,
  add column if not exists logo_offset_x double precision not null default 0,
  add column if not exists logo_offset_y double precision not null default 0;

update public.collectivities
set logo_scale = coalesce(logo_scale, 1),
    logo_offset_x = coalesce(logo_offset_x, 0),
    logo_offset_y = coalesce(logo_offset_y, 0);
