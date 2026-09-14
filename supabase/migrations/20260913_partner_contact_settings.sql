-- Adresse qui reçoit les demandes du formulaire « Devenir partenaire ».
create table if not exists public.partner_contact_settings (
  id text primary key default 'default',
  partner_request_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_contact_settings_singleton_check check (id = 'default')
);

insert into public.partner_contact_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.partner_contact_settings enable row level security;
alter table public.partner_contact_settings force row level security;

revoke all on table public.partner_contact_settings from anon, authenticated;
grant all on table public.partner_contact_settings to service_role;

notify pgrst, 'reload schema';
