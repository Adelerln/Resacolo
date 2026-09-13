-- Demandes de suppression de compte famille (RGPD) — traitement manuel Mnemos

create extension if not exists pgcrypto;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  user_id text not null,
  email text not null,
  full_name text not null default '',
  reason text not null default '',

  status text not null default 'pending'
    check (status in ('pending', 'processed', 'rejected')),

  notes text not null default '',
  processed_at timestamptz,
  processed_by text,

  constraint account_deletion_requests_email_not_blank
    check (length(trim(email)) > 0)
);

comment on table public.account_deletion_requests is
  'Demandes de suppression de compte famille ; traitées manuellement par Mnemos.';

create index if not exists account_deletion_requests_created_at_idx
  on public.account_deletion_requests (created_at desc);

create index if not exists account_deletion_requests_status_created_at_idx
  on public.account_deletion_requests (status, created_at desc);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id, created_at desc);

-- Une seule demande en cours par compte
create unique index if not exists account_deletion_requests_one_pending_per_user_idx
  on public.account_deletion_requests (user_id)
  where status = 'pending';

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_requests force row level security;

revoke all on table public.account_deletion_requests from anon, authenticated;
grant all on table public.account_deletion_requests to service_role;
