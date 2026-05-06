alter table public.collectivities
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text not null default 'France',
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists website_url text,
  add column if not exists description text,
  add column if not exists attachment_instructions text,
  add column if not exists updated_at timestamptz not null default now();

update public.collectivities
set country = coalesce(nullif(country, ''), 'France'),
    updated_at = coalesce(updated_at, now());
