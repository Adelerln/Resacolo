-- Éligibilité CAF / VACAF au niveau du séjour (ex. séjours à l'étranger souvent non éligibles)

alter table public.stays
  add column if not exists is_caf_eligible boolean not null default true;

alter table public.stay_drafts
  add column if not exists is_caf_eligible boolean not null default true;

comment on column public.stays.is_caf_eligible is
  'Indique si ce séjour peut bénéficier des aides CAF / VACAF. À désactiver notamment pour certains séjours à l''étranger.';

comment on column public.stay_drafts.is_caf_eligible is
  'Indique si ce séjour (brouillon) peut bénéficier des aides CAF / VACAF.';

-- Harmonise payment_aids si la colonne existe déjà
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stays'
      and column_name = 'payment_aids'
  ) then
    update public.stays
    set payment_aids = array(
      select distinct x
      from unnest(
        case
          when is_caf_eligible then coalesce(payment_aids, '{}'::text[]) || array['caf_vouchers']
          else array_remove(coalesce(payment_aids, '{}'::text[]), 'caf_vouchers')
        end
      ) as x
      where x is not null and btrim(x) <> ''
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
