-- =============================================================================
-- Resacolo — verrouillage RLS (SQL Editor Supabase)
-- =============================================================================
-- Contexte : Next.js utilise SUPABASE_SERVICE_ROLE_KEY (bypass RLS).
-- Aujourd’hui la clé anon peut notamment LIRE staff_users et ÉCRIRE inquiries.
--
-- Effet : RLS + FORCE RLS, révocation anon/authenticated, grants service_role.
-- Auth navigateur (sign-in / reset password) n’est PAS impactée (schéma auth).
-- =============================================================================

begin;

-- Contraintes utiles prod (no-op si déjà OK)
alter table public.inquiries drop constraint if exists inquiries_source_check;
alter table public.inquiries
  add constraint inquiries_source_check
  check (
    source is null
    or source in ('CONTACT_FORM', 'PLATFORM', 'MNEMOS', 'MNEMOS_TRANSFER')
  );

alter table public.orders
  add column if not exists partially_paid_at timestamptz,
  add column if not exists transferred_at timestamptz,
  add column if not exists request_kind text,
  add column if not exists external_aid_cents integer not null default 0,
  add column if not exists external_paid_cents integer not null default 0;

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'accommodation_media',
    'accommodations',
    'aid_claims',
    'audit_logs',
    'chat_events',
    'chat_messages',
    'chat_sessions',
    'checkout_carts',
    'client_children',
    'client_profiles',
    'clients',
    'collectivities',
    'collectivity_contacts',
    'collectivity_contributions',
    'collectivity_members',
    'collectivity_stay_exclusions',
    'credit_notes',
    'favorites',
    'inquiries',
    'insurance_options',
    'invoice_counters',
    'invoice_lines',
    'invoices',
    'order_item_extra_options',
    'order_items',
    'orders',
    'organizer_backoffice_access',
    'organizer_billing_events',
    'organizer_billing_settings',
    'organizer_commission_history',
    'organizer_members',
    'organizer_support_requests',
    'organizers',
    'payment_installments',
    'payments',
    'rag_chunks',
    'rag_documents',
    'rag_embeddings',
    'rag_index_queue',
    'resacolo_billing_settings',
    'resacolo_fee_ledger',
    'seasons',
    'session_holds',
    'session_prices',
    'sessions',
    'staff_users',
    'stay_accommodations',
    'stay_drafts',
    'stay_extra_options',
    'stay_import_jobs',
    'stay_media',
    'stays',
    'support_request_messages',
    'transport_options',
    'user_login_events'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'skip missing table: %', t;
      continue;
    end if;

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end
$$;

do $$
declare
  v text;
  views text[] := array[
    'organizer_admin_overview',
    'mnemos_organizer_billing_overview'
  ];
begin
  foreach v in array views loop
    if to_regclass(format('public.%I', v)) is null then
      raise notice 'skip missing view: %', v;
      continue;
    end if;
    execute format('revoke all on table public.%I from anon, authenticated', v);
    execute format('grant all on table public.%I to service_role', v);
  end loop;
end
$$;

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_next_stay_import_job',
        'cron_archive_finished_stays',
        'cron_complete_sessions',
        'cron_expire_holds',
        'next_invoice_number',
        'purge_old_chatbot_data',
        'log_user_login_event',
        'match_rag_chunks',
        'search_rag_chunks'
      )
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name, fn.function_name, fn.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      fn.schema_name, fn.function_name, fn.args
    );
  end loop;
end
$$;

do $$
declare
  s record;
begin
  for s in
    select sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('revoke all on sequence public.%I from anon, authenticated', s.sequencename);
    execute format('grant all on sequence public.%I to service_role', s.sequencename);
  end loop;
end
$$;

commit;

notify pgrst, 'reload schema';

-- Vérifs :
-- select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
-- Avec anon key : select * from staff_users;  → erreur / vide
-- Avec service_role : back-offices OK
