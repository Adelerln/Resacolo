import type { Metadata } from 'next';
import { getAllFaqPairs } from '@/lib/faq-content';
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
  'séjours enfants',
  'colo été',
  'colonie été',
  'séjour ado',
  'colonie ado',
  'colonie ski',
  'colonie mer',
  'colonie montagne',
  'réservation colo',
  'catalogue colonies de vacances',
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
  const image = toAbsoluteUrl(input.image || DEFAULT_OG_IMAGE);
  const canonical = path.startsWith('http') ? path : path;

  return {
    title: titleWithoutBrand,
    description,
    keywords: input.keywords?.length ? input.keywords : DEFAULT_SITE_KEYWORDS,
    alternates: {
      canonical,
      languages: {
        'fr-FR': canonical,
        fr: canonical
      }
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
      images: [{ url: image, width: 1200, height: 630, alt: openGraphTitle }]
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
    alternateName: 'ResaColo',
    url: SITE_URL,
    logo: toAbsoluteUrl('/image/accueil/images_accueil/logo-resacolo.png'),
    image: toAbsoluteUrl(DEFAULT_OG_IMAGE),
    description: DEFAULT_SITE_DESCRIPTION,
    email: 'contact@resacolo.com',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'contact@resacolo.com',
        availableLanguage: ['French'],
        url: `${SITE_URL}/contact`
      }
    ],
    sameAs: [] as string[],
    areaServed: [
      { '@type': 'Country', name: 'France' },
      { '@type': 'Continent', name: 'Europe' }
    ],
    knowsAbout: [
      'Colonies de vacances',
      'Séjours pour enfants',
      'Séjours pour adolescents',
      'Vacances éducatives'
    ]
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
    publisher: {
      '@type': 'Organization',
      name: 'Resacolo',
      url: SITE_URL
    },
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

export function buildFaqPageJsonLd() {
  const pairs = getAllFaqPairs();
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((pair) => ({
      '@type': 'Question',
      name: pair.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: pair.answer
      }
    }))
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path)
    }))
  };
}

export function serializeJsonLd(payload: Record<string, unknown> | Record<string, unknown>[]) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
