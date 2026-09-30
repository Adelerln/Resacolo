import type { Metadata } from 'next';
import { getAllFaqPairs } from '@/lib/faq-content';
import { RESACOLO_COMPANY } from '@/lib/resacolo-company';
import { DEFAULT_STAY_OG_IMAGE_PATH, SITE_URL, toAbsoluteUrl } from '@/lib/seo';

const DEFAULT_OG_IMAGE = DEFAULT_STAY_OG_IMAGE_PATH;

/** Titre / description par défaut orientés intentions de recherche colo FR. */
export const DEFAULT_SITE_TITLE =
  'Colonies de vacances et séjours pour enfants | Resacolo';

export const DEFAULT_SITE_DESCRIPTION =
  'Comparez et réservez des colonies de vacances et séjours pour enfants partout en France et à l’étranger. Organisateurs du collectif, dates, âges et tarifs clairs sur Resacolo.';

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
  'colonie toussaint',
  'séjour linguistique',
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
  ogType?: 'website' | 'article';
}): Metadata {
  // Le layout applique le template "%s | Resacolo" — on passe le titre sans suffixe.
  const titleWithoutBrand = input.title.replace(/\s*\|\s*Resacolo\s*$/i, '').trim();
  const openGraphTitle = input.title.includes('Resacolo')
    ? input.title
    : `${titleWithoutBrand} | Resacolo`;
  const description = input.description.trim().slice(0, 160);
  const path = input.path ?? '/';
  const image = toAbsoluteUrl(input.image || DEFAULT_OG_IMAGE);
  const canonical = path.startsWith('http') ? path : path;

  return {
    title: titleWithoutBrand,
    description,
    keywords: input.keywords?.length ? input.keywords : DEFAULT_SITE_KEYWORDS,
    category: 'travel',
    alternates: {
      canonical,
      languages: {
        'fr-FR': canonical,
        fr: canonical,
        'x-default': canonical
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
      type: input.ogType ?? 'website',
      locale: 'fr_FR',
      images: [{ url: image, width: 1200, height: 630, alt: openGraphTitle }]
    },
    twitter: {
      card: 'summary_large_image',
      title: openGraphTitle,
      description,
      images: [image]
    },
    other: {
      'geo.region': 'FR',
      'geo.placename': 'Paris'
    }
  };
}

export function buildOrganizationJsonLd() {
  const logoUrl = toAbsoluteUrl('/image/accueil/images_accueil/logo-resacolo.png');
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'TravelAgency'],
    '@id': `${SITE_URL}/#organization`,
    name: 'Resacolo',
    legalName: `${RESACOLO_COMPANY.legalName} ${RESACOLO_COMPANY.legalForm}`,
    alternateName: ['ResaColo', 'Resacolo SAS'],
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: logoUrl,
      contentUrl: logoUrl
    },
    image: toAbsoluteUrl(DEFAULT_OG_IMAGE),
    description: DEFAULT_SITE_DESCRIPTION,
    email: 'contact@resacolo.com',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: RESACOLO_COMPANY.city,
        addressCountry: 'FR'
      }
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: RESACOLO_COMPANY.addressLine1,
      postalCode: RESACOLO_COMPANY.postalCode,
      addressLocality: RESACOLO_COMPANY.city,
      addressCountry: 'FR'
    },
    identifier: [
      {
        '@type': 'PropertyValue',
        name: 'SIRET',
        value: RESACOLO_COMPANY.siret
      },
      {
        '@type': 'PropertyValue',
        name: 'TVA',
        value: RESACOLO_COMPANY.vatNumber
      },
      {
        '@type': 'PropertyValue',
        name: 'Atout France',
        value: RESACOLO_COMPANY.atoutFranceRegistration
      }
    ],
    vatID: RESACOLO_COMPANY.vatNumber,
    taxID: RESACOLO_COMPANY.siret,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'contact@resacolo.com',
        availableLanguage: ['French', 'fr'],
        areaServed: 'FR',
        url: `${SITE_URL}/contact`
      }
    ],
    sameAs: [] as string[],
    areaServed: [
      { '@type': 'Country', name: 'France', sameAs: 'https://www.wikidata.org/wiki/Q142' },
      { '@type': 'Continent', name: 'Europe' }
    ],
    knowsAbout: [
      'Colonies de vacances',
      'Séjours pour enfants',
      'Séjours pour adolescents',
      'Séjours linguistiques',
      'Vacances éducatives',
      'Colonies de ski',
      'Colonies à la mer'
    ],
    slogan: 'La plateforme des colonies de vacances du collectif'
  };
}

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Resacolo',
    url: SITE_URL,
    description: DEFAULT_SITE_DESCRIPTION,
    inLanguage: 'fr-FR',
    publisher: { '@id': `${SITE_URL}/#organization` },
    about: { '@id': `${SITE_URL}/#organization` },
    potentialAction: [
      {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/sejours?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    ]
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: toAbsoluteUrl(input.path),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Colonies de vacances'
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: toAbsoluteUrl(item.path)
      }))
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
