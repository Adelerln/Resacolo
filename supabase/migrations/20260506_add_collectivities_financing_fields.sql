alter table public.collectivities
  add column if not exists finance_mode text not null default 'TOTAL',
  add column if not exists finance_percent_value double precision,
  add column if not exists finance_fixed_cents integer,
  add column if not exists finance_rules_text text;
