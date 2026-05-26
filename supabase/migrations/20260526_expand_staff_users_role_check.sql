alter table public.staff_users
  drop constraint if exists staff_users_role_check;

alter table public.staff_users
  add constraint staff_users_role_check
  check (
    role is not null
    and (
      upper(role) in (
        'ADMIN',
        'SALES_ADMIN',
        'ADMIN_SALES',
        'PLATFORM_ADMIN',
        'ADMIN_RESACOLO',
        'SUPPORT'
      )
      or upper(role) like 'MNEMOS%'
    )
  );

