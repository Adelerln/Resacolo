-- Remplacer les anciens statuts de commande par leurs équivalents actuels.
-- L'enum PostgreSQL conserve ses anciennes étiquettes pour compatibilité de schéma,
-- mais cette contrainte interdit désormais de les enregistrer dans orders.
begin;

update public.orders
set status = 'PENDING_PAYMENT'
where status in ('VALIDATED', 'BOOKED');

update public.orders
set status = 'PAID',
    paid_at = coalesce(paid_at, updated_at, created_at)
where status = 'CONFIRMED';

alter table public.orders
  drop constraint if exists orders_status_no_legacy_check;

alter table public.orders
  add constraint orders_status_no_legacy_check
  check (status not in ('VALIDATED', 'BOOKED', 'CONFIRMED'));

commit;
