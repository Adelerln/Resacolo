-- =============================================================================
-- Remédiation Security Advisor Supabase
-- Lints : 0011 (search_path), 0028/0029 (SECURITY DEFINER exposé)
-- =============================================================================

begin;

do $$
declare
  r record;
  fn_names text[] := array[
    'set_updated_at',
    'set_hold_expiry',
    'refresh_hold_expiry_on_order_status',
    'update_session_fullness',
    'assign_invoice_number',
    'assign_credit_note_number',
    'cron_archive_finished_stays',
    'cron_complete_sessions',
    'cron_expire_holds',
    'next_invoice_number',
    'resolve_app_role_for_user'
  ];
  revoke_names text[] := array[
    'resolve_app_role_for_user',
    'next_invoice_number',
    'cron_archive_finished_stays',
    'cron_complete_sessions',
    'cron_expire_holds',
    'claim_next_stay_import_job'
  ];
begin
  -- 1) Figé search_path = public, pg_temp
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (fn_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      r.schema_name,
      r.function_name,
      r.args
    );
    raise notice 'search_path set on %.%(%)', r.schema_name, r.function_name, r.args;
  end loop;

  -- 2) Révoquer EXECUTE pour anon / authenticated sur les fonctions sensibles
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (revoke_names)
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      r.schema_name,
      r.function_name,
      r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      r.schema_name,
      r.function_name,
      r.args
    );
    raise notice 'execute revoked for anon/auth on %.%(%)', r.schema_name, r.function_name, r.args;
  end loop;
end
$$;

commit;

notify pgrst, 'reload schema';
