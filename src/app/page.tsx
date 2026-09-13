import { HomePageClient } from '@/components/home/HomePageClient';
import {
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildWebsiteJsonLd,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_KEYWORDS,
  DEFAULT_SITE_TITLE,
  serializeJsonLd
} from '@/lib/seo-meta';

export const metadata = buildPageMetadata({
  title: DEFAULT_SITE_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  path: '/',
  keywords: DEFAULT_SITE_KEYWORDS
});

export default function HomePage() {
  const organizationJsonLd = serializeJsonLd(buildOrganizationJsonLd());
  const websiteJsonLd = serializeJsonLd(buildWebsiteJsonLd());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
      <HomePageClient />
    </>
  );
}
