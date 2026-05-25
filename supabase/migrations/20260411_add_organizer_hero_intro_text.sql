alter table public.organizers
add column if not exists hero_intro_text text;

comment on column public.organizers.hero_intro_text is
  'Texte court affiche sous le titre de la page publique organisateur.';
