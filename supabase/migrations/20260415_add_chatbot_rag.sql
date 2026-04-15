-- Chatbot RAG public Resacolo
-- - socle documents/chunks/embeddings
-- - file d'indexation incrémentale
-- - sessions/messages/événements chatbot
-- - fonctions retrieval hybride et purge
-- - triggers d'enqueue sur tables métiers principales

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null unique,
  source_type text not null,
  source_id text not null,
  source_url text,
  title text not null,
  content_hash text not null,
  pii_redacted boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_documents_source_type_idx on public.rag_documents (source_type, source_id);
create index if not exists rag_documents_updated_at_idx on public.rag_documents (updated_at desc);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  content_hash text not null,
  token_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector generated always as (to_tsvector('french', coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists rag_chunks_document_id_idx on public.rag_chunks (document_id);
create index if not exists rag_chunks_search_tsv_idx on public.rag_chunks using gin (search_tsv);

create table if not exists public.rag_embeddings (
  chunk_id uuid primary key references public.rag_chunks (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_embeddings_embedding_idx
  on public.rag_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.rag_index_queue (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null unique,
  source_type text not null,
  source_id text not null,
  reason text not null default 'upsert',
  status text not null default 'PENDING',
  priority integer not null default 100,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_index_queue_status_idx
  on public.rag_index_queue (status, next_attempt_at, priority, created_at);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'fr-FR',
  user_agent text,
  ip_hash text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_last_activity_idx on public.chat_sessions (last_activity_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  confidence double precision,
  handoff_suggested boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);

create table if not exists public.chat_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_events_type_created_idx on public.chat_events (event_type, created_at desc);
create index if not exists chat_events_session_created_idx on public.chat_events (session_id, created_at);

create or replace function public.match_rag_chunks(
  query_embedding vector(1536),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_ref text,
  source_type text,
  source_url text,
  title text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.source_ref,
    d.source_type,
    d.source_url,
    d.title,
    c.content,
    c.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.rag_embeddings e
  join public.rag_chunks c on c.id = e.chunk_id
  join public.rag_documents d on d.id = c.document_id
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.search_rag_chunks(
  query_text text,
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_ref text,
  source_type text,
  source_url text,
  title text,
  content text,
  metadata jsonb,
  rank double precision
)
language sql
stable
as $$
  with q as (
    select nullif(trim(query_text), '') as raw_query
  )
  select
    c.id as chunk_id,
    c.document_id,
    d.source_ref,
    d.source_type,
    d.source_url,
    d.title,
    c.content,
    c.metadata,
    ts_rank_cd(c.search_tsv, websearch_to_tsquery('french', q.raw_query))::double precision as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  join q on true
  where q.raw_query is not null
    and c.search_tsv @@ websearch_to_tsquery('french', q.raw_query)
  order by rank desc
  limit greatest(match_count, 1);
$$;

create or replace function public.purge_old_chatbot_data(retention_days integer default 30)
returns integer
language plpgsql
security definer
as $$
declare
  deleted_sessions integer := 0;
begin
  delete from public.chat_sessions
  where last_activity_at < (now() - make_interval(days => greatest(retention_days, 1)));
  get diagnostics deleted_sessions = row_count;

  return deleted_sessions;
end;
$$;

create or replace function public.enqueue_rag_index_event()
returns trigger
language plpgsql
as $$
declare
  v_id text;
  v_source_type text;
  v_payload jsonb;
begin
  v_id := coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'));
  if v_id is null or v_id = '' then
    return coalesce(new, old);
  end if;

  v_source_type := case tg_table_name
    when 'organizers' then 'organizer'
    when 'stays' then 'stay'
    when 'collectivities' then 'collectivity'
    when 'inquiries' then 'inquiry'
    when 'organizer_support_requests' then 'support_request'
    else tg_table_name
  end;

  v_payload := jsonb_build_object(
    'table', tg_table_name,
    'operation', tg_op,
    'source_type', v_source_type,
    'source_id', v_id,
    'deleted', tg_op = 'DELETE'
  );

  insert into public.rag_index_queue (
    source_ref,
    source_type,
    source_id,
    reason,
    status,
    next_attempt_at,
    payload
  )
  values (
    v_source_type || ':' || v_id,
    v_source_type,
    v_id,
    lower(tg_op),
    'PENDING',
    now(),
    v_payload
  )
  on conflict (source_ref) do update
    set
      source_type = excluded.source_type,
      source_id = excluded.source_id,
      reason = excluded.reason,
      status = 'PENDING',
      next_attempt_at = now(),
      payload = excluded.payload,
      last_error = null,
      locked_at = null,
      processed_at = null,
      updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists organizers_rag_enqueue_trg on public.organizers;
create trigger organizers_rag_enqueue_trg
after insert or update or delete on public.organizers
for each row execute function public.enqueue_rag_index_event();

drop trigger if exists stays_rag_enqueue_trg on public.stays;
create trigger stays_rag_enqueue_trg
after insert or update or delete on public.stays
for each row execute function public.enqueue_rag_index_event();

drop trigger if exists collectivities_rag_enqueue_trg on public.collectivities;
create trigger collectivities_rag_enqueue_trg
after insert or update or delete on public.collectivities
for each row execute function public.enqueue_rag_index_event();

drop trigger if exists inquiries_rag_enqueue_trg on public.inquiries;
create trigger inquiries_rag_enqueue_trg
after insert or update or delete on public.inquiries
for each row execute function public.enqueue_rag_index_event();

drop trigger if exists organizer_support_requests_rag_enqueue_trg on public.organizer_support_requests;
create trigger organizer_support_requests_rag_enqueue_trg
after insert or update or delete on public.organizer_support_requests
for each row execute function public.enqueue_rag_index_event();
