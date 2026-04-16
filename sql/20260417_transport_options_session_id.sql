-- Optionnel si la colonne existe déjà : liaison transport ↔ session (ville offerte seulement sur certaines sessions).
ALTER TABLE public.transport_options
  ADD COLUMN IF NOT EXISTS session_id uuid NULL REFERENCES public.sessions (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS transport_options_session_id_idx
  ON public.transport_options (session_id)
  WHERE session_id IS NOT NULL;

COMMENT ON COLUMN public.transport_options.session_id IS
  'NULL = option affichée pour toutes les sessions du séjour ; sinon limitée à cette session.';
