import { ACCENT_HEX, PRODUCT_NAME, TAGLINE } from "@/lib/constants";
import { siteContent } from "@/lib/content";

const { meta } = siteContent;

export const defaultSEO = {
  title: meta?.title ?? PRODUCT_NAME,
  description: meta?.description ?? TAGLINE,
  defaultTitle: PRODUCT_NAME,
  openGraph: {
    type: "website",
    url: "https://mosaicflow.io",
    title: meta?.title ?? PRODUCT_NAME,
    description: meta?.description ?? TAGLINE,
    siteName: PRODUCT_NAME,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${PRODUCT_NAME} open graph image`,
      },
    ],
  },
  twitter: {
    cardType: "summary_large_image",
  },
  themeColor: ACCENT_HEX,
};
