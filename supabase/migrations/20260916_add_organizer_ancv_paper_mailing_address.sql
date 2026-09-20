-- Adresse postale pour l'envoi des chèques-vacances papier (si l'organisateur les accepte)

alter table public.organizers
  add column if not exists ancv_paper_mailing_address text;

comment on column public.organizers.ancv_paper_mailing_address is
  'Adresse postale à laquelle la famille doit envoyer les chèques-vacances papier.';

notify pgrst, 'reload schema';
