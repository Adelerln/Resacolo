import type { Metadata } from 'next';
import { DEFAULT_STAY_OG_IMAGE_PATH, SITE_URL, toAbsoluteUrl } from '@/lib/seo';

const DEFAULT_OG_IMAGE = DEFAULT_STAY_OG_IMAGE_PATH;

/** Titre / description par défaut orientés intentions de recherche colo FR. */
export const DEFAULT_SITE_TITLE =
  'Colonies de vacances et séjours pour enfants | Resacolo';

export const DEFAULT_SITE_DESCRIPTION =
  'Comparez et réservez des colonies de vacances et séjours pour enfants partout en France et à l’étranger. Organisateurs vérifiés, dates, âges et tarifs sur Resacolo.';

export const DEFAULT_SITE_KEYWORDS = [
  'colonie de vacances',
  'colonies de vacances',
  'séjour enfants',
  'colo été',
  'colonie été',
  'séjour ado',
  'colonie ski',
  'colonie mer',
  'réservation colo',
  'Resacolo'
];

export function buildPageMetadata(input: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}): Metadata {
  // Le layout applique le template "%s | Resacolo" — on passe le titre sans suffixe.
  const titleWithoutBrand = input.title.replace(/\s*\|\s*Resacolo\s*$/i, '').trim();
  const openGraphTitle = input.title.includes('Resacolo')
    ? input.title
    : `${titleWithoutBrand} | Resacolo`;
  const description = input.description.trim();
  const path = input.path ?? '/';
  const image = input.image || DEFAULT_OG_IMAGE;
  const canonical = path.startsWith('http') ? path : path;

  return {
    title: titleWithoutBrand,
    description,
    keywords: input.keywords?.length ? input.keywords : DEFAULT_SITE_KEYWORDS,
    alternates: {
      canonical
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1
          }
        },
    openGraph: {
      title: openGraphTitle,
      description,
      url: canonical,
      siteName: 'Resacolo',
      type: 'website',
      locale: 'fr_FR',
      images: [{ url: image, alt: openGraphTitle }]
    },
    twitter: {
      card: 'summary_large_image',
      title: openGraphTitle,
      description,
      images: [image]
    }
  };
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Resacolo',
    url: SITE_URL,
    logo: toAbsoluteUrl(DEFAULT_OG_IMAGE),
    description: DEFAULT_SITE_DESCRIPTION,
    sameAs: [] as string[],
    areaServed: {
      '@type': 'Country',
      name: 'France'
    }
  };
}

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Resacolo',
    url: SITE_URL,
    description: DEFAULT_SITE_DESCRIPTION,
    inLanguage: 'fr-FR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/sejours?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function serializeJsonLd(payload: Record<string, unknown> | Record<string, unknown>[]) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
