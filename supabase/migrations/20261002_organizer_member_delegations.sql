-- Délégations membres : notifications commandes, récap hebdo, fiche organisateur

ALTER TABLE public.organizer_members
  ADD COLUMN IF NOT EXISTS can_manage_organizer_profile boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizers
  ADD COLUMN IF NOT EXISTS order_status_notify_member_id uuid,
  ADD COLUMN IF NOT EXISTS weekly_recap_notify_member_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizers_order_status_notify_member_id_fkey'
  ) THEN
    ALTER TABLE public.organizers
      ADD CONSTRAINT organizers_order_status_notify_member_id_fkey
      FOREIGN KEY (order_status_notify_member_id)
      REFERENCES public.organizer_members (id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizers_weekly_recap_notify_member_id_fkey'
  ) THEN
    ALTER TABLE public.organizers
      ADD CONSTRAINT organizers_weekly_recap_notify_member_id_fkey
      FOREIGN KEY (weekly_recap_notify_member_id)
      REFERENCES public.organizer_members (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.organizer_members.can_manage_organizer_profile IS
  'Accès à la fiche organisateur (paramétrage public) en plus du rôle OWNER.';
COMMENT ON COLUMN public.organizers.order_status_notify_member_id IS
  'Membre désigné pour recevoir les emails de statut / nouvelles commandes.';
COMMENT ON COLUMN public.organizers.weekly_recap_notify_member_id IS
  'Membre désigné pour recevoir le récap hebdomadaire des places.';
