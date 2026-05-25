alter table public.stay_drafts
  add column if not exists source_url_canonical text;

create or replace function public.normalize_stay_source_url_canonical(input_url text)
returns text
language plpgsql
as $$
declare
  raw_url text := btrim(coalesce(input_url, ''));
  work_url text;
  scheme text;
  authority text;
  authority_normalized text;
  path_part text;
  query_part text;
  query_normalized text;
begin
  if raw_url = '' then
    return null;
  end if;

  if raw_url !~* '^https?://' then
    return raw_url;
  end if;

  work_url := regexp_replace(raw_url, '#.*$', '');

  scheme := lower(substring(work_url from '^(https?)://'));
  authority := substring(work_url from '^(?:https?://)([^/?#]+)');
  path_part := coalesce(substring(work_url from '^(?:https?://)[^/?#]+([^?#]*)'), '');
  query_part := substring(work_url from '\?([^#]*)$');

  if scheme is null or authority is null then
    return raw_url;
  end if;

  authority_normalized := lower(authority);
  if scheme = 'http' then
    authority_normalized := regexp_replace(authority_normalized, ':80$', '');
  elsif scheme = 'https' then
    authority_normalized := regexp_replace(authority_normalized, ':443$', '');
  end if;

  path_part := regexp_replace(path_part, '/{2,}', '/', 'g');
  if path_part = '' then
    path_part := '/';
  elsif path_part <> '/' then
    path_part := regexp_replace(path_part, '/+$', '');
    if path_part = '' then
      path_part := '/';
    end if;
  end if;

  if query_part is not null and query_part <> '' then
    with query_pairs as (
      select unnest(string_to_array(query_part, '&')) as pair
    ),
    parsed_pairs as (
      select
        split_part(pair, '=', 1) as key_raw,
        case
          when strpos(pair, '=') > 0 then substring(pair from strpos(pair, '=') + 1)
          else ''
        end as value_raw
      from query_pairs
      where pair <> ''
    ),
    filtered_pairs as (
      select
        key_raw,
        value_raw
      from parsed_pairs
      where key_raw <> ''
        and lower(key_raw) !~ '^utm_'
        and lower(key_raw) not in ('fbclid', 'gclid', 'msclkid', 'dclid', 'ref')
    ),
    normalized_pairs as (
      select
        key_raw || case when value_raw <> '' then '=' || value_raw else '' end as pair
      from filtered_pairs
      order by lower(key_raw), value_raw, key_raw
    )
    select string_agg(pair, '&')
      into query_normalized
    from normalized_pairs;
  else
    query_normalized := null;
  end if;

  if query_normalized is null or query_normalized = '' then
    return scheme || '://' || authority_normalized || path_part;
  end if;

  return scheme || '://' || authority_normalized || path_part || '?' || query_normalized;
end;
$$;

update public.stay_drafts
set source_url_canonical = coalesce(
  public.normalize_stay_source_url_canonical(source_url),
  btrim(source_url)
)
where source_url_canonical is null
   or btrim(source_url_canonical) = '';

with ranked as (
  select
    id,
    organizer_id,
    source_url_canonical,
    status,
    updated_at,
    row_number() over (
      partition by organizer_id, source_url_canonical
      order by
        case lower(status)
          when 'ready' then 1
          when 'pending' then 2
          when 'failed' then 3
          else 4
        end,
        updated_at desc,
        id desc
    ) as rank_in_group,
    first_value(id) over (
      partition by organizer_id, source_url_canonical
      order by
        case lower(status)
          when 'ready' then 1
          when 'pending' then 2
          when 'failed' then 3
          else 4
        end,
        updated_at desc,
        id desc
    ) as owner_id
  from public.stay_drafts
  where source_url_canonical is not null
    and btrim(source_url_canonical) <> ''
),
duplicates as (
  select id, owner_id
  from ranked
  where rank_in_group > 1
)
update public.stay_drafts d
set
  raw_payload = jsonb_set(
    case
      when jsonb_typeof(d.raw_payload) = 'object' then d.raw_payload
      else '{}'::jsonb
    end,
    '{duplicate_of_draft_id}',
    to_jsonb(duplicates.owner_id::text),
    true
  ),
  source_url_canonical = d.source_url_canonical || '#dup-' || d.id::text,
  updated_at = greatest(d.updated_at, now())
from duplicates
where d.id = duplicates.id;

update public.stay_drafts
set source_url_canonical = 'invalid-source://draft-' || id::text
where source_url_canonical is null
   or btrim(source_url_canonical) = '';

alter table public.stay_drafts
  alter column source_url_canonical set not null;

create unique index if not exists stay_drafts_organizer_source_url_canonical_uidx
  on public.stay_drafts (organizer_id, source_url_canonical);

comment on column public.stay_drafts.source_url_canonical is
  'URL source canonicalisée pour déduplication des imports organisateur';
