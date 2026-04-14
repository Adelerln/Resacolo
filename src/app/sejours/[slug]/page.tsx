import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Stay } from '@/types/stay';
import { DEFAULT_STAY_OG_IMAGE_PATH, toAbsoluteUrl } from '@/lib/seo';
import { getStays, getStayCanonicalPath, resolveStayBySlug } from '@/lib/stays';
import { StayDetailView } from '@/components/sejours/StayDetailView';

interface StayDetailPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

function getStaySeoDescription(stay: Stay) {
  return stay.summary?.trim() || stay.description?.trim() || stay.title;
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
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'EUR',
    availability: getStayAvailability(stay),
    seller: {
      '@type': 'Organization',
      name: stay.organizer.name,
      url: toAbsoluteUrl(organizerPath)
    }
  };

  if (stay.priceFrom != null) {
    offer.price = stay.priceFrom.toFixed(2);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: stay.title,
    description: getStaySeoDescription(stay),
    sku: stay.id,
    url: canonicalUrl,
    image: [toAbsoluteUrl(getStayOpenGraphImage(stay))],
    brand: {
      '@type': 'Organization',
      name: stay.organizer.name
    },
    offers: offer
  };
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
  const title = `${stay.title} | Resacolo`;
  const description = getStaySeoDescription(stay);
  const canonicalPath = getStayCanonicalPath(stay);
  const image = getStayOpenGraphImage(stay);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath
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

  const stay = resolved.stay;
  const productJsonLd = serializeJsonLd(buildStayProductJsonLd(stay));
  const breadcrumbJsonLd = serializeJsonLd(buildStayBreadcrumbJsonLd(stay));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <StayDetailView stay={stay} />
    </>
  );
}
