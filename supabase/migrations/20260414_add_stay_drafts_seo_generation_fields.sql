alter table public.stay_drafts
  add column if not exists seo_primary_keyword text,
  add column if not exists seo_secondary_keywords text[] not null default '{}',
  add column if not exists seo_target_city text,
  add column if not exists seo_target_region text,
  add column if not exists seo_search_intents text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_meta_description text,
  add column if not exists seo_intro_text text,
  add column if not exists seo_h1_variant text,
  add column if not exists seo_internal_link_anchor_suggestions text[] not null default '{}',
  add column if not exists seo_slug_candidate text,
  add column if not exists seo_generated_at timestamptz,
  add column if not exists seo_generation_source text,
  add column if not exists seo_score integer,
  add column if not exists seo_checks jsonb not null default '[]'::jsonb;

alter table public.stays
  add column if not exists seo_intro_text text,
  add column if not exists seo_h1_variant text,
  add column if not exists seo_internal_link_anchor_suggestions text[] not null default '{}',
  add column if not exists seo_slug_candidate text,
  add column if not exists seo_generated_at timestamptz,
  add column if not exists seo_generation_source text,
  add column if not exists seo_score integer,
  add column if not exists seo_checks jsonb not null default '[]'::jsonb;

comment on column public.stay_drafts.seo_primary_keyword is 'Mot-clé principal SEO généré/édité';
comment on column public.stay_drafts.seo_secondary_keywords is 'Mots-clés secondaires SEO générés/édités';
comment on column public.stay_drafts.seo_target_city is 'Ville SEO cible du draft';
comment on column public.stay_drafts.seo_target_region is 'Région SEO cible du draft';
comment on column public.stay_drafts.seo_search_intents is 'Intentions de recherche SEO du draft';
comment on column public.stay_drafts.seo_title is 'Title SEO généré/édité';
comment on column public.stay_drafts.seo_meta_description is 'Meta description SEO générée/éditée';
comment on column public.stay_drafts.seo_intro_text is 'Paragraphe introductif SEO';
comment on column public.stay_drafts.seo_h1_variant is 'Variante H1 SEO optionnelle';
comment on column public.stay_drafts.seo_internal_link_anchor_suggestions is 'Suggestions d’ancres de maillage interne';
comment on column public.stay_drafts.seo_slug_candidate is 'Suggestion de slug SEO (sans effet canonique)';
comment on column public.stay_drafts.seo_generated_at is 'Horodatage de la dernière génération SEO';
comment on column public.stay_drafts.seo_generation_source is 'Source/version de la génération SEO';
comment on column public.stay_drafts.seo_score is 'Score SEO global (0-100)';
comment on column public.stay_drafts.seo_checks is 'Checklist SEO structurée';

comment on column public.stays.seo_intro_text is 'Paragraphe introductif SEO publié';
comment on column public.stays.seo_h1_variant is 'Variante H1 SEO publiée';
comment on column public.stays.seo_internal_link_anchor_suggestions is 'Ancres de maillage interne publiées';
comment on column public.stays.seo_slug_candidate is 'Suggestion de slug SEO';
comment on column public.stays.seo_generated_at is 'Horodatage de génération SEO';
comment on column public.stays.seo_generation_source is 'Source/version de génération SEO';
comment on column public.stays.seo_score is 'Score SEO global (0-100)';
comment on column public.stays.seo_checks is 'Checklist SEO structurée';
