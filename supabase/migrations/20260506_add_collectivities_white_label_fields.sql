alter table public.collectivities
  add column if not exists brand_primary_color text,
  add column if not exists brand_welcome_text text,
  add column if not exists brand_redirect_url text;
