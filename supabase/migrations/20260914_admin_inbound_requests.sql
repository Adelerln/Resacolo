-- Paramètres + file des demandes partenariat / rejoindre Resacolo (espace admin).

create table if not exists public.admin_inbound_request_settings (
  id text primary key default 'default',
  partner_notification_email text,
  organizer_notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_inbound_request_settings_singleton_check check (id = 'default')
);

insert into public.admin_inbound_request_settings (
  id,
  partner_notification_email,
  organizer_notification_email
)
values (
  'default',
  'jeanne@thalie.org',
  'jeanne@thalie.org'
)
on conflict (id) do nothing;

alter table public.admin_inbound_request_settings enable row level security;
revoke all on table public.admin_inbound_request_settings from anon, authenticated;
grant select, insert, update, delete on table public.admin_inbound_request_settings to service_role;

create table if not exists public.admin_inbound_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'NEW',
  organization_name text,
  contact_first_name text,
  contact_last_name text,
  contact_email text not null,
  contact_phone text,
  formula text,
  atout_france text,
  sdjes text,
  website_url text,
  message text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_inbound_requests_kind_check check (kind in ('PARTNER', 'ORGANIZER')),
  constraint admin_inbound_requests_status_check check (status in ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  constraint admin_inbound_requests_email_not_blank check (length(trim(contact_email)) > 3),
  constraint admin_inbound_requests_message_not_blank check (length(trim(message)) > 0)
);

create index if not exists admin_inbound_requests_created_at_idx
  on public.admin_inbound_requests (created_at desc);

create index if not exists admin_inbound_requests_kind_status_created_at_idx
  on public.admin_inbound_requests (kind, status, created_at desc);

alter table public.admin_inbound_requests enable row level security;
revoke all on table public.admin_inbound_requests from anon, authenticated;
grant select, insert, update, delete on table public.admin_inbound_requests to service_role;
