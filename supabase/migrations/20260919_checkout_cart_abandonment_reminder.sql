-- Relance panier abandonné (e-mail famille 24 h).

alter table public.checkout_carts
  add column if not exists abandonment_reminder_sent_at timestamptz;

create index if not exists checkout_carts_abandonment_reminder_candidates_idx
  on public.checkout_carts (status, created_at)
  where status = 'ACTIVE' and abandonment_reminder_sent_at is null;

comment on column public.checkout_carts.abandonment_reminder_sent_at is
  'Horodatage d’envoi de la relance panier (une seule fois).';
