-- Suppression organisateur TEST + dépendances
-- Coller TOUT le script dans Supabase SQL Editor, puis Run.
-- Les tables absentes sont ignorées.

DO $delete_test_organizer$
DECLARE
  v_organizer_id uuid;
  v_organizer_name text;
  v_match_count integer;
  v_stay_ids uuid[] := '{}';
  v_session_ids uuid[] := '{}';
  v_accommodation_ids uuid[] := '{}';
  v_order_item_ids uuid[] := '{}';
  v_order_ids uuid[] := '{}';
  v_invoice_ids uuid[] := '{}';
  v_payment_ids uuid[] := '{}';
  v_support_ids uuid[] := '{}';
  v_draft_ids uuid[] := '{}';
BEGIN
  SELECT count(*)
  INTO v_match_count
  FROM public.organizers
  WHERE lower(trim(name)) = 'test'
     OR lower(trim(coalesce(slug, ''))) = 'test';

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Aucun organisateur TEST trouvé (name/slug = test).';
  END IF;

  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Plusieurs organisateurs matchent TEST (%). Affinez le filtre.', v_match_count;
  END IF;

  SELECT id, name
  INTO v_organizer_id, v_organizer_name
  FROM public.organizers
  WHERE lower(trim(name)) = 'test'
     OR lower(trim(coalesce(slug, ''))) = 'test';

  RAISE NOTICE 'Suppression organisateur % (%)', v_organizer_name, v_organizer_id;

  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_stay_ids
  FROM public.stays
  WHERE organizer_id = v_organizer_id;

  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_session_ids
  FROM public.sessions
  WHERE stay_id = ANY (v_stay_ids);

  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_accommodation_ids
  FROM public.accommodations
  WHERE organizer_id = v_organizer_id;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE
      'SELECT coalesce(array_agg(id), ''{}''::uuid[]) FROM public.order_items WHERE organizer_id = $1'
      INTO v_order_item_ids
      USING v_organizer_id;

    EXECUTE
      'SELECT coalesce(array_agg(DISTINCT order_id), ''{}''::uuid[]) FROM public.order_items WHERE organizer_id = $1'
      INTO v_order_ids
      USING v_organizer_id;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE
      'SELECT coalesce(array_agg(id), ''{}''::uuid[]) FROM public.invoices WHERE organizer_id = $1 OR order_id = ANY ($2)'
      INTO v_invoice_ids
      USING v_organizer_id, v_order_ids;
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE
      'SELECT coalesce(array_agg(id), ''{}''::uuid[]) FROM public.payments WHERE order_id = ANY ($1)'
      INTO v_payment_ids
      USING v_order_ids;
  END IF;

  IF to_regclass('public.organizer_support_requests') IS NOT NULL THEN
    EXECUTE
      'SELECT coalesce(array_agg(id), ''{}''::uuid[]) FROM public.organizer_support_requests WHERE organizer_id = $1'
      INTO v_support_ids
      USING v_organizer_id;
  END IF;

  IF to_regclass('public.stay_drafts') IS NOT NULL THEN
    EXECUTE
      'SELECT coalesce(array_agg(id), ''{}''::uuid[]) FROM public.stay_drafts WHERE organizer_id = $1'
      INTO v_draft_ids
      USING v_organizer_id;
  END IF;

  RAISE NOTICE
    'stays=%, sessions=%, accommodations=%, order_items=%, orders=%, invoices=%',
    coalesce(array_length(v_stay_ids, 1), 0),
    coalesce(array_length(v_session_ids, 1), 0),
    coalesce(array_length(v_accommodation_ids, 1), 0),
    coalesce(array_length(v_order_item_ids, 1), 0),
    coalesce(array_length(v_order_ids, 1), 0),
    coalesce(array_length(v_invoice_ids, 1), 0);

  -- RAG (optionnel)
  IF to_regclass('public.rag_documents') IS NOT NULL THEN
    IF to_regclass('public.rag_embeddings') IS NOT NULL
       AND to_regclass('public.rag_chunks') IS NOT NULL THEN
      EXECUTE $rag$
        DELETE FROM public.rag_embeddings
        WHERE chunk_id IN (
          SELECT c.id
          FROM public.rag_chunks c
          JOIN public.rag_documents d ON d.id = c.document_id
          WHERE d.source_id = $1
             OR d.source_ref = 'organizer:' || $1
             OR d.source_id = ANY (SELECT unnest($2::uuid[])::text)
             OR d.source_ref = ANY (SELECT 'stay:' || s::text FROM unnest($2::uuid[]) AS s)
        )
      $rag$ USING v_organizer_id::text, v_stay_ids;
    END IF;

    IF to_regclass('public.rag_chunks') IS NOT NULL THEN
      EXECUTE $rag$
        DELETE FROM public.rag_chunks
        WHERE document_id IN (
          SELECT id FROM public.rag_documents
          WHERE source_id = $1
             OR source_ref = 'organizer:' || $1
             OR source_id = ANY (SELECT unnest($2::uuid[])::text)
             OR source_ref = ANY (SELECT 'stay:' || s::text FROM unnest($2::uuid[]) AS s)
        )
      $rag$ USING v_organizer_id::text, v_stay_ids;
    END IF;

    EXECUTE $rag$
      DELETE FROM public.rag_documents
      WHERE source_id = $1
         OR source_ref = 'organizer:' || $1
         OR source_id = ANY (SELECT unnest($2::uuid[])::text)
         OR source_ref = ANY (SELECT 'stay:' || s::text FROM unnest($2::uuid[]) AS s)
    $rag$ USING v_organizer_id::text, v_stay_ids;
  ELSE
    RAISE NOTICE 'Table rag_documents absente : étape RAG ignorée.';
  END IF;

  IF to_regclass('public.rag_index_queue') IS NOT NULL THEN
    EXECUTE
      'DELETE FROM public.rag_index_queue WHERE source_id = $1 OR source_id = ANY (SELECT unnest($2::uuid[])::text)'
      USING v_organizer_id::text, v_stay_ids;
  END IF;

  -- Support
  IF to_regclass('public.support_request_messages') IS NOT NULL
     AND coalesce(array_length(v_support_ids, 1), 0) > 0 THEN
    EXECUTE 'DELETE FROM public.support_request_messages WHERE support_request_id = ANY ($1)'
      USING v_support_ids;
  END IF;

  IF to_regclass('public.organizer_support_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_support_requests WHERE organizer_id = $1'
      USING v_organizer_id;
  END IF;

  -- Commercial
  IF to_regclass('public.resacolo_fee_ledger') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM public.resacolo_fee_ledger
      WHERE organizer_id = $1
         OR stay_id = ANY ($2)
         OR order_item_id = ANY ($3)
         OR order_id = ANY ($4)
    $sql$ USING v_organizer_id, v_stay_ids, v_order_item_ids, v_order_ids;
  END IF;

  IF coalesce(array_length(v_order_item_ids, 1), 0) > 0 THEN
    IF to_regclass('public.aid_claims') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.aid_claims WHERE order_item_id = ANY ($1)' USING v_order_item_ids;
    END IF;
    IF to_regclass('public.collectivity_contributions') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.collectivity_contributions WHERE order_item_id = ANY ($1)' USING v_order_item_ids;
    END IF;
    IF to_regclass('public.session_holds') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.session_holds WHERE order_item_id = ANY ($1)' USING v_order_item_ids;
    END IF;
    IF to_regclass('public.order_item_extra_options') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.order_item_extra_options WHERE order_item_id = ANY ($1)' USING v_order_item_ids;
    END IF;
  END IF;

  IF to_regclass('public.session_holds') IS NOT NULL
     AND coalesce(array_length(v_session_ids, 1), 0) > 0 THEN
    EXECUTE 'DELETE FROM public.session_holds WHERE session_id = ANY ($1)' USING v_session_ids;
  END IF;

  IF to_regclass('public.checkout_carts') IS NOT NULL THEN
    EXECUTE 'UPDATE public.checkout_carts SET converted_order_id = NULL WHERE converted_order_id = ANY ($1)'
      USING v_order_ids;
    EXECUTE 'DELETE FROM public.checkout_carts WHERE organizer_id = $1 OR converted_order_id = ANY ($2)'
      USING v_organizer_id, v_order_ids;
  END IF;

  IF coalesce(array_length(v_payment_ids, 1), 0) > 0 THEN
    IF to_regclass('public.payment_installments') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.payment_installments WHERE payment_id = ANY ($1)' USING v_payment_ids;
    END IF;
    IF to_regclass('public.payments') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.payments WHERE id = ANY ($1)' USING v_payment_ids;
    END IF;
  END IF;

  IF to_regclass('public.organizer_billing_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_billing_events WHERE organizer_id = $1'
      USING v_organizer_id;
  END IF;

  IF coalesce(array_length(v_invoice_ids, 1), 0) > 0 THEN
    IF to_regclass('public.credit_notes') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.credit_notes WHERE invoice_id = ANY ($1)' USING v_invoice_ids;
    END IF;
    IF to_regclass('public.invoice_lines') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.invoice_lines WHERE invoice_id = ANY ($1)' USING v_invoice_ids;
    END IF;
    IF to_regclass('public.invoices') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.invoices WHERE id = ANY ($1)' USING v_invoice_ids;
    END IF;
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.order_items WHERE organizer_id = $1' USING v_organizer_id;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL
     AND coalesce(array_length(v_order_ids, 1), 0) > 0 THEN
    EXECUTE $sql$
      DELETE FROM public.orders o
      WHERE o.id = ANY ($1)
        AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
    $sql$ USING v_order_ids;
  END IF;

  -- Catalogue
  IF coalesce(array_length(v_stay_ids, 1), 0) > 0 THEN
    IF to_regclass('public.favorites') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.favorites WHERE stay_id = ANY ($1)' USING v_stay_ids;
    END IF;
    IF to_regclass('public.collectivity_stay_exclusions') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.collectivity_stay_exclusions WHERE stay_id = ANY ($1)' USING v_stay_ids;
    END IF;
    IF to_regclass('public.stay_media') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.stay_media WHERE stay_id = ANY ($1)' USING v_stay_ids;
    END IF;
    IF to_regclass('public.stay_extra_options') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.stay_extra_options WHERE stay_id = ANY ($1)' USING v_stay_ids;
    END IF;
    IF to_regclass('public.stay_accommodations') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.stay_accommodations WHERE stay_id = ANY ($1)' USING v_stay_ids;
    END IF;
    IF to_regclass('public.transport_options') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.transport_options WHERE stay_id = ANY ($1) OR session_id = ANY ($2)'
        USING v_stay_ids, v_session_ids;
    END IF;
    IF to_regclass('public.insurance_options') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.insurance_options WHERE stay_id = ANY ($1) OR session_id = ANY ($2)'
        USING v_stay_ids, v_session_ids;
    END IF;
    IF to_regclass('public.session_prices') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.session_prices WHERE session_id = ANY ($1)' USING v_session_ids;
    END IF;

    DELETE FROM public.sessions WHERE stay_id = ANY (v_stay_ids);
    DELETE FROM public.stays WHERE id = ANY (v_stay_ids);
  END IF;

  -- Imports / brouillons
  IF to_regclass('public.stay_import_jobs') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM public.stay_import_jobs
      WHERE organizer_id = $1
         OR draft_id = ANY ($2)
         OR selected_accommodation_id = ANY ($3)
    $sql$ USING v_organizer_id, v_draft_ids, v_accommodation_ids;
  END IF;

  IF to_regclass('public.stay_drafts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.stay_drafts WHERE organizer_id = $1' USING v_organizer_id;
  END IF;

  -- Hébergements
  IF coalesce(array_length(v_accommodation_ids, 1), 0) > 0 THEN
    IF to_regclass('public.accommodation_media') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.accommodation_media WHERE accommodation_id = ANY ($1)'
        USING v_accommodation_ids;
    END IF;
    DELETE FROM public.accommodations WHERE id = ANY (v_accommodation_ids);
  END IF;

  -- Accès / config
  IF to_regclass('public.weekly_stock_report_email_logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.weekly_stock_report_email_logs WHERE organizer_id = $1' USING v_organizer_id;
  END IF;
  IF to_regclass('public.organizer_commission_history') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_commission_history WHERE organizer_id = $1' USING v_organizer_id;
  END IF;
  IF to_regclass('public.organizer_billing_settings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_billing_settings WHERE organizer_id = $1' USING v_organizer_id;
  END IF;
  IF to_regclass('public.organizer_backoffice_access') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_backoffice_access WHERE organizer_id = $1' USING v_organizer_id;
  END IF;
  IF to_regclass('public.organizer_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.organizer_members WHERE organizer_id = $1' USING v_organizer_id;
  END IF;
  IF to_regclass('public.inquiries') IS NOT NULL THEN
    EXECUTE 'UPDATE public.inquiries SET organizer_id = NULL WHERE organizer_id = $1' USING v_organizer_id;
  END IF;

  DELETE FROM public.organizers WHERE id = v_organizer_id;

  RAISE NOTICE 'Organisateur TEST supprimé avec succès.';
END;
$delete_test_organizer$;
