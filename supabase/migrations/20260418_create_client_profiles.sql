create table if not exists public.client_profiles (
  user_id text primary key,
  parent1_first_name text not null default '',
  parent1_last_name text not null default '',
  parent1_email text not null default '',
  parent1_phone text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'France',
  has_separate_billing_address boolean not null default false,
  billing_address_line1 text not null default '',
  billing_address_line2 text not null default '',
  billing_postal_code text not null default '',
  billing_city text not null default '',
  billing_country text not null default 'France',
  cse_organization text not null default '',
  vacaf_number text not null default '',
  payment_mode text not null default 'FULL',
  parent2_name text not null default '',
  parent2_status text not null default 'pere',
  parent2_status_other text not null default '',
  parent2_phone text not null default '',
  parent2_email text not null default '',
  parent2_has_different_address boolean not null default false,
  parent2_address_line1 text not null default '',
  parent2_address_line2 text not null default '',
  parent2_postal_code text not null default '',
  parent2_city text not null default '',
  children_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_profiles_payment_mode_check check (
    payment_mode in ('FULL', 'DEPOSIT_200', 'CV_CONNECT', 'CV_PAPER', 'DEFERRED')
  ),
  constraint client_profiles_parent2_status_check check (
    parent2_status in ('pere', 'mere', 'grand-parent', 'autre')
  )
);

create index if not exists client_profiles_updated_at_idx on public.client_profiles (updated_at desc);
