create table if not exists public.resacolo_billing_settings (
  id text primary key default 'default',
  founding_member_commission_percent numeric(5, 2) not null default 0,
  resacolo_member_commission_percent numeric(5, 2) not null default 0,
  external_commission_percent numeric(5, 2) not null default 0,
  publication_fee_enabled boolean not null default false,
  publication_fee_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resacolo_billing_settings_singleton_check check (id = 'default'),
  constraint resacolo_billing_settings_commission_bounds check (
    founding_member_commission_percent >= 0
    and founding_member_commission_percent <= 100
    and resacolo_member_commission_percent >= 0
    and resacolo_member_commission_percent <= 100
    and external_commission_percent >= 0
    and external_commission_percent <= 100
  ),
  constraint resacolo_billing_settings_publication_fee_non_negative check (publication_fee_cents >= 0)
);

insert into public.resacolo_billing_settings (
  id,
  founding_member_commission_percent,
  resacolo_member_commission_percent,
  external_commission_percent,
  publication_fee_enabled,
  publication_fee_cents
)
values ('default', 0, 0, 0, false, 0)
on conflict (id) do nothing;
