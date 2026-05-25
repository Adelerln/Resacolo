create table if not exists public.organizer_backoffice_access (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  app_user_id text not null,
  role text not null check (role in ('OWNER', 'EDITOR', 'RESERVATION_MANAGER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, app_user_id)
);

create index if not exists organizer_backoffice_access_app_user_idx
  on public.organizer_backoffice_access (app_user_id);

create index if not exists organizer_backoffice_access_organizer_idx
  on public.organizer_backoffice_access (organizer_id);
