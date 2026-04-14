#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function load(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return readFileSync(absolutePath, 'utf8');
}

const checks = [
  {
    file: 'src/lib/stays.ts',
    required: [
      'canonicalSlug',
      'legacySlugs',
      'resolveStayBySlug',
      'getStayCanonicalPath',
      'validateStaysSeoCatalog(stays);'
    ]
  },
  {
    file: 'src/app/sejours/[slug]/page.tsx',
    required: [
      'alternates:',
      'canonical:',
      'openGraph:',
      'twitter:',
      'application/ld+json',
      'BreadcrumbList',
      "'@type': 'Product'",
      'permanentRedirect'
    ]
  },
  {
    file: 'src/app/sitemap.ts',
    required: ['MetadataRoute.Sitemap', 'getStayCanonicalPath', '/sejours']
  },
  {
    file: 'src/app/robots.ts',
    required: ['MetadataRoute.Robots', 'sitemap', 'disallow']
  },
  {
    file: 'src/components/sejours/StayDetailView.tsx',
    required: ['aria-label="Fil d’Ariane"', 'href={organizerHref}', 'relatedStayLinks']
  },
  {
    file: 'src/components/organisme/StaySeoEditor.tsx',
    required: [
      'SEO du séjour',
      'seo_primary_keyword',
      'seo_secondary_keywords',
      'seo_search_intents',
      'Aperçu Google'
    ]
  },
  {
    file: 'src/lib/stay-seo.ts',
    required: ['buildStaySeoSuggestions', 'buildStaySeoWarnings', 'buildRelatedStayLinks']
  },
  {
    file: 'src/components/organisme/StayDraftReviewForm.tsx',
    required: ['Générer le SEO', 'Regénérer le SEO', 'seo_intro_text', 'seo_internal_link_anchor_suggestions']
  },
  {
    file: 'src/app/api/stay-drafts/[id]/seo/route.ts',
    required: ['generateStayDraftSeo', 'alreadyGenerated', 'seo_generation_source']
  },
  {
    file: 'src/lib/stay-draft-seo.ts',
    required: ['generateStayDraftSeo', 'seo_score', 'seo_checks', 'seo_slug_candidate']
  }
];

let hasErrors = false;

for (const check of checks) {
  const content = load(check.file);
  for (const snippet of check.required) {
    if (!content.includes(snippet)) {
      hasErrors = true;
      console.error(`ERROR ${check.file}: snippet manquant -> ${snippet}`);
    }
  }
}

if (hasErrors) {
  console.error('\nSEO check échoué.');
  process.exit(1);
}

console.log('SEO check OK (canonical, JSON-LD, sitemap, robots, maillage).');
