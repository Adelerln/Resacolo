alter table public.stays
  add column if not exists payment_aids text[] not null default '{}';

alter table public.stay_drafts
  add column if not exists payment_aids text[] not null default '{}';

with stay_scan as (
  select
    id,
    lower(
      coalesce(description, '') || ' ' ||
      coalesce(program_text, '') || ' ' ||
      coalesce(transport_text, '') || ' ' ||
      coalesce(required_documents_text, '')
    ) as scan
  from public.stays
),
stay_detect as (
  select
    id,
    array_remove(array[
      case
        when scan ~ '\m(ancv connect|cv connect)\M' then 'ancv_connect'
        else null
      end,
      case
        when scan ~ '\m(ancv|ch[eé]que[s]? vacances|ch vacances)\M'
          and scan !~ '\m(ancv connect|cv connect)\M'
        then 'ancv_paper'
        else null
      end,
      case
        when scan ~ '\m(caf|vacaf|bon caf|bons caf)\M' then 'caf_vouchers'
        else null
      end
    ]::text[], null) as aids
  from stay_scan
)
update public.stays s
set payment_aids = coalesce(d.aids, '{}')
from stay_detect d
where d.id = s.id;

with draft_scan as (
  select
    id,
    lower(
      coalesce(description, '') || ' ' ||
      coalesce(program_text, '') || ' ' ||
      coalesce(transport_text, '') || ' ' ||
      coalesce(required_documents_text, '') || ' ' ||
      coalesce(raw_payload::text, '')
    ) as scan
  from public.stay_drafts
),
draft_detect as (
  select
    id,
    array_remove(array[
      case
        when scan ~ '\m(ancv connect|cv connect)\M' then 'ancv_connect'
        else null
      end,
      case
        when scan ~ '\m(ancv|ch[eé]que[s]? vacances|ch vacances)\M'
          and scan !~ '\m(ancv connect|cv connect)\M'
        then 'ancv_paper'
        else null
      end,
      case
        when scan ~ '\m(caf|vacaf|bon caf|bons caf)\M' then 'caf_vouchers'
        else null
      end
    ]::text[], null) as aids
  from draft_scan
)
update public.stay_drafts d
set payment_aids = coalesce(x.aids, '{}')
from draft_detect x
where x.id = d.id;
