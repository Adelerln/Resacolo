-- Relances acompte / solde + parcours annulation organisateur.
-- Compatible avec les bases où PENDING_PAYMENT / PARTIALLY_PAID n’existent pas encore.

-- 1) Colonnes d’idempotence / alerte
alter table public.orders
  add column if not exists deposit_reminder_sent_at timestamptz,
  add column if not exists balance_reminder_sent_at timestamptz,
  add column if not exists payment_reminder_missing_email_alerted_at timestamptz;

-- 2) Enrichir l’enum order_status si besoin (avant les index filtrés)
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and e.enumlabel = 'PENDING_PAYMENT'
  ) then
    alter type public.order_status add value 'PENDING_PAYMENT';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and e.enumlabel = 'PARTIALLY_PAID'
  ) then
    alter type public.order_status add value 'PARTIALLY_PAID';
  end if;
end $$;

-- 3) Index candidats — sans prédicat sur les nouvelles valeurs d’enum
--    (évite l’erreur « new enum value cannot be used in same transaction »).
--    Le filtrage métier (PENDING_PAYMENT / PARTIALLY_PAID) reste côté app.
create index if not exists orders_deposit_reminder_candidates_idx
  on public.orders (created_at)
  where deposit_reminder_sent_at is null;

create index if not exists orders_balance_reminder_candidates_idx
  on public.orders (balance_reminder_sent_at)
  where balance_reminder_sent_at is null;

comment on column public.orders.deposit_reminder_sent_at is
  'Horodatage d’envoi de la relance acompte J+7 (une seule fois).';
comment on column public.orders.balance_reminder_sent_at is
  'Horodatage d’envoi de la relance solde J-30 (une seule fois).';
comment on column public.orders.payment_reminder_missing_email_alerted_at is
  'Horodatage de l’alerte Mnemos si email client introuvable pour une relance.';

-- 4) Parcours annulation / remboursement
create table if not exists public.order_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  kind text not null check (kind in ('CANCEL_ONLY', 'REFUND')),
  status text not null default 'PENDING_MNEMOS'
    check (status in ('PENDING_MNEMOS', 'APPROVED', 'REJECTED', 'CANCELLED_DIRECT')),
  reason text not null,
  attachment_path text null,
  amount_cents integer null check (amount_cents is null or amount_cents >= 0),
  created_by_user_id uuid null,
  reviewed_by_user_id uuid null,
  reviewed_at timestamptz null,
  review_note text null
);

create index if not exists order_cancellation_requests_status_idx
  on public.order_cancellation_requests (status, created_at desc);

create index if not exists order_cancellation_requests_order_idx
  on public.order_cancellation_requests (order_id, created_at desc);

create index if not exists order_cancellation_requests_organizer_idx
  on public.order_cancellation_requests (organizer_id, created_at desc);

comment on table public.order_cancellation_requests is
  'Annulations organisateur (immédiates sans paiement) ou demandes de remboursement à valider par Mnemos.';
