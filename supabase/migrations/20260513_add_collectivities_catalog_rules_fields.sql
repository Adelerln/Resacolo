alter table public.collectivities
  add column if not exists catalog_rules_draft jsonb,
  add column if not exists catalog_rules_published jsonb,
  add column if not exists catalog_rules_published_at timestamptz;
