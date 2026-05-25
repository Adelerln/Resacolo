alter table public.collectivity_members
  drop constraint if exists collectivity_members_role_check;

alter table public.collectivity_members
  add constraint collectivity_members_role_check
  check (role in ('OWNER', 'PARTNER_AGENT', 'PARTNER_ADMIN', 'PARTNER_BENEFICIARY_MANAGER'));
