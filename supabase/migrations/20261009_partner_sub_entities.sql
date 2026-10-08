-- Sous-entités partenaires (CSE) + roster pré-compte QF/email

ALTER TABLE public.collectivities
  ADD COLUMN IF NOT EXISTS sub_entities_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collectivities.sub_entities_enabled IS
  'Autorise le partenaire à créer des sous-entités (admin uniquement).';

CREATE TABLE IF NOT EXISTS public.collectivity_sub_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivity_id uuid NOT NULL REFERENCES public.collectivities (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collectivity_sub_entities_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS collectivity_sub_entities_collectivity_id_idx
  ON public.collectivity_sub_entities (collectivity_id);

CREATE UNIQUE INDEX IF NOT EXISTS collectivity_sub_entities_collectivity_name_uidx
  ON public.collectivity_sub_entities (collectivity_id, lower(trim(name)));

ALTER TABLE public.collectivity_members
  ADD COLUMN IF NOT EXISTS sub_entity_id uuid REFERENCES public.collectivity_sub_entities (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS collectivity_members_sub_entity_id_idx
  ON public.collectivity_members (sub_entity_id);

COMMENT ON COLUMN public.collectivity_members.sub_entity_id IS
  'Si renseigné, le membre ne voit que les ayants-droit de cette sous-entité.';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sub_entity_id uuid REFERENCES public.collectivity_sub_entities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_sub_entity_id_idx
  ON public.clients (sub_entity_id);

COMMENT ON COLUMN public.clients.sub_entity_id IS
  'Sous-entité du CSE à laquelle la famille est rattachée.';

CREATE TABLE IF NOT EXISTS public.collectivity_beneficiary_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivity_id uuid NOT NULL REFERENCES public.collectivities (id) ON DELETE CASCADE,
  sub_entity_id uuid REFERENCES public.collectivity_sub_entities (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  family_quotient numeric,
  family_quotient_expires_on date,
  claimed_user_id uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collectivity_beneficiary_roster_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS collectivity_beneficiary_roster_collectivity_email_uidx
  ON public.collectivity_beneficiary_roster (collectivity_id, lower(trim(email)));

CREATE INDEX IF NOT EXISTS collectivity_beneficiary_roster_sub_entity_id_idx
  ON public.collectivity_beneficiary_roster (sub_entity_id);

CREATE INDEX IF NOT EXISTS collectivity_beneficiary_roster_claimed_user_id_idx
  ON public.collectivity_beneficiary_roster (claimed_user_id);

COMMENT ON TABLE public.collectivity_beneficiary_roster IS
  'Ayants-droit pré-importés (email + QF) avant création de compte ; claim automatique à l''inscription.';
