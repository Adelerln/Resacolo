-- Journal unifié des connexions utilisateurs (familles, organisateurs, partenaires, admin, sales, mnemos…)

create extension if not exists pgcrypto;

create table if not exists public.user_login_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  user_id text,
  email text,

  outcome text not null check (outcome in ('success', 'failure')),
  error_code text,

  app_role text not null check (
    app_role in ('CLIENT', 'ORGANISATEUR', 'PARTENAIRE', 'ADMIN', 'ADMIN_SALES', 'MNEMOS', 'UNKNOWN')
  ),

  login_mode text check (login_mode is null or login_mode in ('family', 'pro')),
  login_path text,
  redirect_to text,
  ip_address text,
  user_agent text,

  staff_roles text[] not null default '{}'::text[],
  organizer_ids text[] not null default '{}'::text[],
  collectivity_ids text[] not null default '{}'::text[],
  membership_roles jsonb not null default '{}'::jsonb,

  source text not null default 'app' check (source in ('app', 'auth_trigger', 'oauth', 'magic_link')),
  metadata jsonb not null default '{}'::jsonb,

  constraint user_login_events_success_requires_user
    check (outcome = 'failure' or user_id is not null)
);

comment on table public.user_login_events is
  'Journal des connexions (succès/échecs) pour tous les types d''utilisateurs Resacolo.';

create index if not exists user_login_events_created_at_idx
  on public.user_login_events (created_at desc);

create index if not exists user_login_events_user_id_created_at_idx
  on public.user_login_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists user_login_events_email_created_at_idx
  on public.user_login_events (lower(email), created_at desc)
  where email is not null;

create index if not exists user_login_events_app_role_created_at_idx
  on public.user_login_events (app_role, created_at desc);

create index if not exists user_login_events_outcome_created_at_idx
  on public.user_login_events (outcome, created_at desc);

alter table public.user_login_events enable row level security;

drop policy if exists user_login_events_select_staff on public.user_login_events;
create policy user_login_events_select_staff
  on public.user_login_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_users su
      where su.user_id = auth.uid()::text
        and (
          upper(su.role) like '%MNEMOS%'
          or upper(su.role) in (
            'ADMIN',
            'SALES_ADMIN',
            'ADMIN_SALES',
            'PLATFORM_ADMIN',
            'ADMIN_RESACOLO',
            'SUPPORT'
          )
          or upper(su.role) like '%ADMIN%'
        )
    )
  );

revoke all on table public.user_login_events from anon, authenticated;
grant select on table public.user_login_events to authenticated;
grant all on table public.user_login_events to service_role;

-- Trigger auth retiré : l'app journalise via insert service_role avec contexte complet.
drop trigger if exists on_auth_user_signed_in on auth.users;
drop function if exists public.log_auth_user_sign_in();
