create table if not exists public.collectivity_contacts (
  id uuid primary key default gen_random_uuid(),
  collectivity_id uuid not null references public.collectivities(id) on delete cascade,
  full_name text not null,
  role_label text,
  email text not null,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collectivity_contacts_collectivity_id_idx
  on public.collectivity_contacts (collectivity_id);

create unique index if not exists collectivity_contacts_one_primary_per_collectivity_idx
  on public.collectivity_contacts (collectivity_id)
  where is_primary = true;

insert into public.collectivity_contacts (collectivity_id, full_name, email, phone, is_primary)
select
  c.id,
  coalesce(nullif(trim(c.contact_name), ''), c.name),
  c.contact_email,
  c.contact_phone,
  true
from public.collectivities c
where c.contact_email is not null
  and not exists (
    select 1
    from public.collectivity_contacts cc
    where cc.collectivity_id = c.id
  );
