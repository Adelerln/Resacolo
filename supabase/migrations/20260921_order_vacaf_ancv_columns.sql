-- Colonnes workflow commande manquantes sur certaines bases (VACAF / ANCV / résolution).

alter table public.orders
  add column if not exists vacaf_number_snapshot text null,
  add column if not exists ancv_connect_matricule text null,
  add column if not exists ancv_connect_requested_amount_cents integer null
    check (ancv_connect_requested_amount_cents is null or ancv_connect_requested_amount_cents >= 0),
  add column if not exists request_resolved_at timestamptz null;

comment on column public.orders.vacaf_number_snapshot is
  'Matricule allocataire CAF / VACAF saisi au checkout.';
comment on column public.orders.ancv_connect_matricule is
  'Matricule ANCV Connect saisi au checkout.';
comment on column public.orders.ancv_connect_requested_amount_cents is
  'Montant ANCV Connect demandé par la famille (centimes).';
comment on column public.orders.request_resolved_at is
  'Horodatage de résolution organisme (montant CAF / ANCV saisi).';
