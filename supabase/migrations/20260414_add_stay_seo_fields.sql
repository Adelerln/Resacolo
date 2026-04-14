alter table public.stays
  add column if not exists seo_primary_keyword text,
  add column if not exists seo_secondary_keywords text[] not null default '{}',
  add column if not exists seo_target_city text,
  add column if not exists seo_target_region text,
  add column if not exists seo_search_intents text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_meta_description text;

comment on column public.stays.seo_primary_keyword is 'Mot-clé principal SEO du séjour';
comment on column public.stays.seo_secondary_keywords is 'Mots-clés secondaires SEO du séjour';
comment on column public.stays.seo_target_city is 'Ville cible SEO';
comment on column public.stays.seo_target_region is 'Région cible SEO';
comment on column public.stays.seo_search_intents is 'Intentions de recherche SEO';
comment on column public.stays.seo_title is 'Title SEO personnalisé';
comment on column public.stays.seo_meta_description is 'Meta description SEO personnalisée';
