-- Table source de vérité des enfants du compte famille.
-- (Référencée par le code / types / RLS, mais absente des migrations historiques.)

create table if not exists public.client_children (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  first_name text not null default '',
  last_name text not null default '',
  birthdate date not null,
  gender text not null default '',
  additional_info text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_children_gender_check check (gender in ('', 'MASCULIN', 'FEMININ'))
);

create index if not exists client_children_user_id_idx on public.client_children (user_id);
create index if not exists client_children_birthdate_idx on public.client_children (birthdate desc);

do $$
begin
  if to_regclass('public.clients') is not null then
    alter table public.client_children drop constraint if exists client_children_user_id_fkey;
    alter table public.client_children
      add constraint client_children_user_id_fkey
      foreign key (user_id) references public.clients (user_id) on delete cascade;
  end if;
exception
  when others then
    raise notice 'client_children FK skipped: %', sqlerrm;
end
$$;

alter table public.client_children enable row level security;
alter table public.client_children force row level security;
revoke all on table public.client_children from anon, authenticated;
grant all on table public.client_children to service_role;
