-- Clients et réservations historiques WordPress / WooCommerce (import CSV).
-- Pas de montants / paiements / factures : historique UI uniquement.

create table if not exists public.legacy_wp_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  wp_customer_id integer null,
  wp_user_id integer null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'France',
  registered_at timestamptz null,
  claimed_user_id uuid null,
  constraint legacy_wp_customers_email_key unique (email)
);

create index if not exists legacy_wp_customers_claimed_user_id_idx
  on public.legacy_wp_customers (claimed_user_id)
  where claimed_user_id is not null;

create index if not exists legacy_wp_customers_wp_user_id_idx
  on public.legacy_wp_customers (wp_user_id)
  where wp_user_id is not null;

comment on table public.legacy_wp_customers is
  'Clients WooCommerce importés (customer_lookup + dernière adresse billing). Claim Auth à la demande.';

create table if not exists public.legacy_wp_reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  wp_order_id bigint not null,
  wp_order_item_id bigint not null,
  stay_title text not null,
  session_start_date date null,
  session_end_date date null,
  reserved_at timestamptz null,
  status_code text not null,
  status_label text not null,
  constraint legacy_wp_reservations_order_item_key unique (wp_order_item_id)
);

create index if not exists legacy_wp_reservations_email_idx
  on public.legacy_wp_reservations (email);

create index if not exists legacy_wp_reservations_order_id_idx
  on public.legacy_wp_reservations (wp_order_id);

comment on table public.legacy_wp_reservations is
  'Réservations historiques Woo (line_items). Aucun montant exposé à l’UI.';

alter table public.legacy_wp_customers enable row level security;
alter table public.legacy_wp_reservations enable row level security;

drop policy if exists legacy_wp_customers_select_own on public.legacy_wp_customers;
create policy legacy_wp_customers_select_own
  on public.legacy_wp_customers
  for select
  to authenticated
  using (
    claimed_user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists legacy_wp_reservations_select_own on public.legacy_wp_reservations;
create policy legacy_wp_reservations_select_own
  on public.legacy_wp_reservations
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or exists (
      select 1
      from public.legacy_wp_customers c
      where lower(c.email) = lower(legacy_wp_reservations.email)
        and c.claimed_user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
