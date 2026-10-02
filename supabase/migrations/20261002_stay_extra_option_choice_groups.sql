ALTER TABLE public.stay_extra_options
  ADD COLUMN IF NOT EXISTS choice_group_label text,
  ADD COLUMN IF NOT EXISTS choice_value text;

COMMENT ON COLUMN public.stay_extra_options.choice_group_label IS
  'Libellé du groupe de choix restreints (ex. Thème, Pack).';
COMMENT ON COLUMN public.stay_extra_options.choice_value IS
  'Valeur choisie dans le groupe (ex. Ski, Snowboard).';
