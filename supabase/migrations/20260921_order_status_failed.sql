-- Statut commande dédié aux échecs de paiement CB (distinct de CANCELLED / annulée).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and e.enumlabel = 'FAILED'
  ) then
    alter type public.order_status add value 'FAILED';
  end if;
end $$;
