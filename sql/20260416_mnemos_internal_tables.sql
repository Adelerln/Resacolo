-- Tables internes Mnemos (support, demandes, journal facturation organisateur).
-- À exécuter sur Supabase si les tables n’existent pas encore. Ne modifie pas les RLS.

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'NEW',
  inquiry_type text not null default 'GENERAL',
  contact_name text,
  contact_email text not null,
  contact_phone text,
  subject text,
  message text not null,
  assigned_to_user_id text,
  internal_notes text
);

create table if not exists public.organizer_support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  status text not null default 'OPEN',
  priority text not null default 'NORMAL',
  category text,
  subject text,
  body text,
  assigned_to_user_id text,
  created_by_user_id text,
  resolved_at timestamptz
);

create table if not exists public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  support_request_id uuid not null references public.organizer_support_requests (id) on delete cascade,
  author_user_id text not null,
  body text not null,
  is_internal boolean not null default false
);

create table if not exists public.organizer_billing_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  event_type text not null,
  invoice_id uuid references public.invoices (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id text
);

create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);
create index if not exists organizer_support_org_status_idx
  on public.organizer_support_requests (organizer_id, status, created_at desc);
create index if not exists support_request_messages_request_idx
  on public.support_request_messages (support_request_id, created_at);
create index if not exists organizer_billing_events_org_idx
  on public.organizer_billing_events (organizer_id, created_at desc);
