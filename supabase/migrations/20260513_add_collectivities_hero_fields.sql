alter table public.collectivities
  add column if not exists hero_enabled boolean not null default false,
  add column if not exists hero_title text,
  add column if not exists hero_body text,
  add column if not exists hero_cta_label text,
  add column if not exists hero_cta_url text;
