begin;

alter type public.order_status add value if not exists 'PENDING_PAYMENT';
alter type public.order_status add value if not exists 'PARTIALLY_PAID';
alter type public.order_status add value if not exists 'TRANSFERRED';

alter table public.organizers
  add column if not exists accepts_ancv_paper boolean not null default false,
  add column if not exists accepts_ancv_connect boolean not null default false,
  add column if not exists is_vacaf_approved boolean not null default false;

alter table public.orders
  add column if not exists request_kind text,
  add column if not exists vacaf_number_snapshot text,
  add column if not exists ancv_connect_matricule text,
  add column if not exists ancv_connect_requested_amount_cents integer,
  add column if not exists external_aid_cents integer not null default 0,
  add column if not exists external_paid_cents integer not null default 0,
  add column if not exists request_resolved_at timestamp with time zone,
  add column if not exists partially_paid_at timestamp with time zone,
  add column if not exists transferred_at timestamp with time zone;

update public.orders
set external_aid_cents = coalesce(external_aid_cents, 0),
    external_paid_cents = coalesce(external_paid_cents, 0);

alter table public.orders
  drop constraint if exists orders_request_kind_check;

alter table public.orders
  add constraint orders_request_kind_check
  check (request_kind in ('VACAF', 'ANCV_CONNECT') or request_kind is null);

create table if not exists public.checkout_carts (
  id uuid primary key,
  client_user_id uuid null,
  organizer_id uuid null references public.organizers(id) on delete set null,
  converted_order_id uuid null references public.orders(id) on delete set null,
  status text not null default 'ACTIVE',
  last_step text not null default 'session',
  items_snapshot jsonb not null default '[]'::jsonb,
  contact_snapshot jsonb null,
  participants_snapshot jsonb null,
  pricing_snapshot jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.checkout_carts
  drop constraint if exists checkout_carts_status_check;

alter table public.checkout_carts
  add constraint checkout_carts_status_check
  check (status in ('ACTIVE', 'CONVERTED', 'ABANDONED'));

create index if not exists checkout_carts_client_user_id_idx on public.checkout_carts(client_user_id);
create index if not exists checkout_carts_organizer_id_idx on public.checkout_carts(organizer_id);
create index if not exists checkout_carts_status_idx on public.checkout_carts(status);

commit;

notify pgrst, 'reload schema';
