create table if not exists public.organizer_commission_history (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  source text not null default 'SYNC',
  status_code text not null,
  commission_percent numeric(5, 2) not null,
  effective_from timestamptz not null,
  effective_to timestamptz null,
  created_at timestamptz not null default now(),
  constraint organizer_commission_history_status_code_check check (
    status_code in ('FOUNDING_MEMBER', 'RESACOLO_MEMBER', 'EXTERNAL')
  ),
  constraint organizer_commission_history_commission_bounds check (
    commission_percent >= 0 and commission_percent <= 100
  ),
  constraint organizer_commission_history_range_check check (
    effective_to is null or effective_to > effective_from
  )
);

create index if not exists organizer_commission_history_organizer_id_idx
  on public.organizer_commission_history (organizer_id);

create index if not exists organizer_commission_history_lookup_idx
  on public.organizer_commission_history (organizer_id, effective_from desc);

create unique index if not exists organizer_commission_history_single_open_idx
  on public.organizer_commission_history (organizer_id)
  where effective_to is null;

insert into public.organizer_commission_history (
  organizer_id,
  source,
  status_code,
  commission_percent,
  effective_from,
  effective_to
)
select
  o.id,
  'BACKFILL',
  case
    when o.is_founding_member then 'FOUNDING_MEMBER'
    when o.is_resacolo_member then 'RESACOLO_MEMBER'
    else 'EXTERNAL'
  end,
  coalesce(
    obs.commission_percent,
    case
      when o.is_founding_member then rbs.founding_member_commission_percent
      when o.is_resacolo_member then rbs.resacolo_member_commission_percent
      else rbs.external_commission_percent
    end,
    0
  ),
  coalesce(obs.updated_at, obs.created_at, o.created_at, now()),
  null
from public.organizers o
left join public.organizer_billing_settings obs
  on obs.organizer_id = o.id
left join public.resacolo_billing_settings rbs
  on rbs.id = 'default'
where not exists (
  select 1
  from public.organizer_commission_history och
  where och.organizer_id = o.id
);
