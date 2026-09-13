-- Destinataires des alertes e-mail pour le formulaire de contact public (/contact).
create table if not exists public.contact_form_notification_settings (
  id text primary key default 'default',
  notification_emails text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_form_notification_settings_singleton_check check (id = 'default')
);

insert into public.contact_form_notification_settings (id, notification_emails)
values (
  'default',
  array['jeanne@thalie.org', 'adele@thalie.org']::text[]
)
on conflict (id) do nothing;

alter table public.contact_form_notification_settings enable row level security;

revoke all on table public.contact_form_notification_settings from anon, authenticated;
grant select, insert, update, delete on table public.contact_form_notification_settings to service_role;
