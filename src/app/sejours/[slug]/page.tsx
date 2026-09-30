import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Stay } from '@/types/stay';
import { DEFAULT_STAY_OG_IMAGE_PATH, toAbsoluteUrl } from '@/lib/seo';
import { getStays, getStayCanonicalPath, resolveStayBySlug } from '@/lib/stays';
import { buildStayH1Title, buildStaySeoKeywords, buildStaySeoMetaDescription, buildStaySeoTitle, buildRelatedStayLinks } from '@/lib/stay-seo';
import { StayDetailView } from '@/components/sejours/StayDetailView';
import { getCurrentUser } from '@/lib/auth/session';
import { applyCsePricingToStay, readUserCsePricingContext } from '@/lib/cse-pricing';
import { applyPartnerDiscountPricingToStay, readUserPartnerPricingContext } from '@/lib/stay-partner-pricing';

interface StayDetailPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

function toStaySeoInput(stay: Stay) {
  return {
    title: stay.title,
    summary: stay.summary,
    description: stay.description,
    activitiesText: stay.activitiesText,
    programText: stay.programText,
    location: stay.location,
    region: stay.region,
    seasonName: stay.seasonName,
    ageRange: stay.ageRange,
    categories: stay.categories,
    seo: {
      primaryKeyword: stay.seo?.primaryKeyword,
      secondaryKeywords: stay.seo?.secondaryKeywords ?? [],
      targetCity: stay.seo?.targetCity,
      targetRegion: stay.seo?.targetRegion,
      searchIntents: stay.seo?.searchIntents ?? [],
      title: stay.seo?.title,
      metaDescription: stay.seo?.metaDescription,
      introText: stay.seo?.introText,
      h1Variant: stay.seo?.h1Variant,
      internalLinkAnchorSuggestions: stay.seo?.internalLinkAnchorSuggestions ?? [],
      slugCandidate: stay.seo?.slugCandidate,
      score: stay.seo?.score,
      checks: stay.seo?.checks,
      generatedAt: stay.seo?.generatedAt,
      generationSource: stay.seo?.generationSource
    }
  };
}

function getStayOpenGraphImage(stay: Stay) {
  return stay.coverImage || DEFAULT_STAY_OG_IMAGE_PATH;
}

function getStayAvailability(stay: Stay) {
  const hasOpenSessions = (stay.bookingOptions?.sessions ?? []).some((session) => session.status === 'OPEN');
  return hasOpenSessions ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut';
}

function buildStayProductJsonLd(stay: Stay) {
  const canonicalPath = getStayCanonicalPath(stay);
  const canonicalUrl = toAbsoluteUrl(canonicalPath);
  const organizerPath = stay.organizer.slug ? `/organisateurs/${stay.organizer.slug}` : '/organisateurs';
  const seoInput = toStaySeoInput(stay);
  const seoKeywords = buildStaySeoKeywords(seoInput);
  const imageUrl = toAbsoluteUrl(getStayOpenGraphImage(stay));
  const sessions = stay.bookingOptions?.sessions ?? [];
  const openSessions = sessions.filter((session) => session.status === 'OPEN');
  const nextSession = openSessions[0] ?? sessions[0];
  const ageLabel =
    stay.ageMin != null && stay.ageMax != null
      ? `${stay.ageMin}–${stay.ageMax} ans`
      : stay.ageRange || null;

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'EUR',
    availability: getStayAvailability(stay),
    category: 'Colonies de vacances',
    seller: {
      '@type': 'Organization',
      name: stay.organizer.name,
      url: toAbsoluteUrl(organizerPath)
    }
  };

  if (stay.priceFrom != null) {
    offer.price = stay.priceFrom.toFixed(2);
    offer.priceValidUntil = nextSession?.endDate || undefined;
  }

  const additionalProperty: Array<Record<string, unknown>> = [];
  if (ageLabel) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Tranche d’âge',
      value: ageLabel
    });
  }
  if (stay.seasonName) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Période',
      value: stay.seasonName
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name: stay.title,
    description: buildStaySeoMetaDescription(seoInput),
    sku: stay.id,
    url: canonicalUrl,
    image: [imageUrl],
    keywords: seoKeywords.join(', '),
    category: 'Colonies de vacances',
    brand: {
      '@type': 'Organization',
      name: stay.organizer.name,
      url: toAbsoluteUrl(organizerPath)
    },
    ...(additionalProperty.length ? { additionalProperty } : {}),
    offers: offer
  };
}

function buildStayTouristTripJsonLd(stay: Stay) {
  const canonicalPath = getStayCanonicalPath(stay);
  const canonicalUrl = toAbsoluteUrl(canonicalPath);
  const seoInput = toStaySeoInput(stay);
  const sessions = stay.bookingOptions?.sessions ?? [];
  const nextSession = sessions.find((session) => session.status === 'OPEN') ?? sessions[0];
  const placeName =
    stay.destinationCity || stay.location || stay.region || stay.destinationRegion || 'France';

  const trip: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${canonicalUrl}#trip`,
    name: stay.title,
    description: buildStaySeoMetaDescription(seoInput),
    url: canonicalUrl,
    image: toAbsoluteUrl(getStayOpenGraphImage(stay)),
    touristType: 'Family',
    provider: {
      '@type': 'Organization',
      name: stay.organizer.name,
      url: stay.organizer.slug
        ? toAbsoluteUrl(`/organisateurs/${stay.organizer.slug}`)
        : toAbsoluteUrl('/organisateurs')
    },
    itinerary: {
      '@type': 'Place',
      name: placeName,
      address: {
        '@type': 'PostalAddress',
        addressLocality: stay.destinationCity || stay.location || undefined,
        addressRegion: stay.region || stay.destinationRegion || undefined,
        addressCountry: stay.destinationCountry || 'FR'
      }
    }
  };

  if (stay.ageMin != null || stay.ageMax != null) {
    trip.audience = {
      '@type': 'PeopleAudience',
      suggestedMinAge: stay.ageMin ?? undefined,
      suggestedMaxAge: stay.ageMax ?? undefined
    };
  }

  if (nextSession?.startDate) {
    trip.offers = {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'EUR',
      availability: getStayAvailability(stay),
      ...(stay.priceFrom != null ? { price: stay.priceFrom.toFixed(2) } : {}),
      validFrom: nextSession.startDate
    };
  }

  return trip;
}

function buildStayBreadcrumbJsonLd(stay: Stay) {
  const canonicalPath = getStayCanonicalPath(stay);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: toAbsoluteUrl('/')
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Séjours',
        item: toAbsoluteUrl('/sejours')
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: stay.title,
        item: toAbsoluteUrl(canonicalPath)
      }
    ]
  };
}

function serializeJsonLd(payload: Record<string, unknown>) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export async function generateMetadata({ params }: StayDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveStayBySlug(slug);

  if (!resolved) {
    return {
      title: 'Séjour introuvable | Resacolo',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const stay = resolved.stay;
  const seoInput = toStaySeoInput(stay);
  const title = buildStaySeoTitle(seoInput);
  const description = buildStaySeoMetaDescription(seoInput);
  const canonicalPath = getStayCanonicalPath(stay);
  const image = getStayOpenGraphImage(stay);

  return {
    title: {
      absolute: title
    },
    description,
    keywords: buildStaySeoKeywords(seoInput),
    alternates: {
      canonical: canonicalPath,
      languages: {
        'fr-FR': canonicalPath,
        fr: canonicalPath,
        'x-default': canonicalPath
      }
    },
    robots: {
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
      title,
      description,
      url: canonicalPath,
      siteName: 'Resacolo',
      type: 'website',
      locale: 'fr_FR',
      images: [
        {
          url: image,
          alt: `Photo du séjour ${stay.title}`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image]
    }
  };
}

export async function generateStaticParams() {
  try {
    const stays = await getStays();
    return stays.map((stay) => ({ slug: stay.canonicalSlug }));
  } catch {
    return [];
  }
}

export default async function StayDetailPage({ params }: StayDetailPageProps) {
  const { slug } = await params;
  const resolved = await resolveStayBySlug(slug);

  if (!resolved) {
    notFound();
  }

  if (!resolved.isCanonical) {
    permanentRedirect(resolved.canonicalPath);
  }

  const session = await getCurrentUser();
  const userId = session?.isClient && session.userId ? session.userId : null;
  const [partnerPricingContext, csePricingContext, allStays] = userId
    ? await Promise.all([
        readUserPartnerPricingContext(userId),
        readUserCsePricingContext(userId),
        getStays().catch(() => [] as Stay[])
      ])
    : [null, null, await getStays().catch(() => [] as Stay[])];
  let stay = partnerPricingContext
    ? applyPartnerDiscountPricingToStay(resolved.stay, partnerPricingContext)
    : resolved.stay;
  if (csePricingContext) {
    stay = applyCsePricingToStay(stay, csePricingContext);
  }
  const productJsonLd = serializeJsonLd(buildStayProductJsonLd(stay));
  const tripJsonLd = serializeJsonLd(buildStayTouristTripJsonLd(stay));
  const breadcrumbJsonLd = serializeJsonLd(buildStayBreadcrumbJsonLd(stay));
  const seoH1Title = buildStayH1Title(toStaySeoInput(stay));
  const relatedStayLinks = buildRelatedStayLinks(stay, allStays, getStayCanonicalPath);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: tripJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <StayDetailView stay={stay} seoH1Title={seoH1Title} relatedStayLinks={relatedStayLinks} />
    </>
  );
}
