alter table if exists public.organizer_backoffice_access
  add column if not exists access_code text,
  add column if not exists granted_by text,
  add column if not exists granted_at timestamptz not null default now(),
  add column if not exists revoked_by text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoke_reason text;

update public.organizer_backoffice_access
set granted_at = coalesce(granted_at, created_at, now())
where granted_at is null;

with missing_codes as (
  select
    id,
    row_number() over (order by created_at, id) as seq
  from public.organizer_backoffice_access
  where access_code is null
)
update public.organizer_backoffice_access target
set access_code = concat('ORG-', lpad(missing_codes.seq::text, 6, '0'))
from missing_codes
where target.id = missing_codes.id;

alter table if exists public.organizer_backoffice_access
  alter column access_code set not null;

create unique index if not exists organizer_backoffice_access_access_code_key
  on public.organizer_backoffice_access (access_code);

create unique index if not exists organizer_backoffice_access_app_user_unique_key
  on public.organizer_backoffice_access (app_user_id);

create index if not exists organizer_backoffice_access_active_app_user_idx
  on public.organizer_backoffice_access (app_user_id)
  where revoked_at is null;
