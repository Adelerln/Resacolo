create extension if not exists pgcrypto;

create table if not exists public.stay_import_jobs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.stay_drafts(id) on delete cascade,
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  source_url text not null,
  include_pricing boolean not null default true,
  selected_accommodation_id uuid null references public.accommodations(id) on delete set null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz null,
  lock_token text null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_import_jobs_status_check
    check (status in ('queued', 'running', 'retryable', 'succeeded', 'failed'))
);

create unique index if not exists stay_import_jobs_active_draft_uidx
  on public.stay_import_jobs (draft_id)
  where status in ('queued', 'running', 'retryable');

create index if not exists stay_import_jobs_status_next_run_idx
  on public.stay_import_jobs (status, next_run_at asc, created_at asc);

create or replace function public.claim_next_stay_import_job(p_lock_token text)
returns setof public.stay_import_jobs
language plpgsql
as $$
declare
  claimed public.stay_import_jobs%rowtype;
begin
  update public.stay_import_jobs as job
  set
    status = 'running',
    attempt_count = job.attempt_count + 1,
    locked_at = now(),
    lock_token = p_lock_token,
    updated_at = now()
  where job.id = (
    select candidate.id
    from public.stay_import_jobs as candidate
    where candidate.status in ('queued', 'retryable')
      and candidate.next_run_at <= now()
      and (candidate.locked_at is null or candidate.locked_at < now() - interval '15 minutes')
    order by candidate.created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  if claimed.id is null then
    return;
  end if;

  return next claimed;
end;
$$;

grant execute on function public.claim_next_stay_import_job(text) to anon, authenticated, service_role;
