create table if not exists public.stay_drafts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  source_url text not null,
  title text,
  description text,
  image text,
  raw_text text,
  age_min integer,
  age_max integer,
  price_from integer,
  duration_days integer,
  raw_payload jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint stay_drafts_status_check check (status in ('pending', 'ready', 'failed'))
);

create index if not exists stay_drafts_organizer_id_idx on public.stay_drafts (organizer_id);
create index if not exists stay_drafts_status_idx on public.stay_drafts (status);
create index if not exists stay_drafts_created_at_idx on public.stay_drafts (created_at desc);
