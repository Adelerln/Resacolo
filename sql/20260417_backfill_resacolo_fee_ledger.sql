-- Rattrapage du journal après création de resacolo_fee_ledger (commandes déjà payées / séjours déjà publiés).
-- À exécuter une fois sur Supabase après sql/20260414_resacolo_fee_ledger.sql.
-- Idempotent : ne réinsère pas si une ligne COMMISSION+ ou PUBLICATION+ existe déjà pour la même clé.

-- Commissions : même règle métier que l’app (taux = organizer_billing_settings actuel, canal selon collectivity_id).
insert into public.resacolo_fee_ledger (
  occurred_at,
  organizer_id,
  fee_kind,
  channel,
  amount_cents,
  order_id,
  order_item_id,
  stay_id,
  note
)
select
  coalesce(o.paid_at, o.validated_at, o.created_at),
  oi.organizer_id,
  'COMMISSION',
  case when o.collectivity_id is not null then 'PARTNER' else 'CLIENT' end,
  greatest(
    0,
    round(oi.total_price_cents * (coalesce(obs.commission_percent, 0) / 100.0))::integer
  ),
  oi.order_id,
  oi.id,
  null,
  'Backfill SQL (historique)'
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.organizer_billing_settings obs on obs.organizer_id = oi.organizer_id
where o.status in ('PAID', 'CONFIRMED', 'BOOKED')
  and round(oi.total_price_cents * (coalesce(obs.commission_percent, 0) / 100.0))::integer > 0
  and not exists (
    select 1
    from public.resacolo_fee_ledger l
    where l.order_item_id = oi.id
      and l.fee_kind = 'COMMISSION'
      and l.amount_cents > 0
  );

-- Publications : forfait actuel × séjours au statut Publié sans ligne positive déjà.
-- occurred_at : updated_at du séjour (approx. ; pas de date de première publication en base).
insert into public.resacolo_fee_ledger (
  occurred_at,
  organizer_id,
  fee_kind,
  channel,
  amount_cents,
  order_id,
  order_item_id,
  stay_id,
  note
)
select
  s.updated_at,
  s.organizer_id,
  'PUBLICATION',
  'NA',
  greatest(0, coalesce(obs.publication_fee_cents, 0)::integer),
  null,
  null,
  s.id,
  'Backfill SQL (historique)'
from public.stays s
join public.organizer_billing_settings obs on obs.organizer_id = s.organizer_id
where s.status = 'PUBLISHED'
  and coalesce(obs.publication_fee_cents, 0) > 0
  and not exists (
    select 1
    from public.resacolo_fee_ledger l
    where l.stay_id = s.id
      and l.fee_kind = 'PUBLICATION'
      and l.amount_cents > 0
  );
