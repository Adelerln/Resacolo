import { z } from "zod";

import homepageJson from "@/content/homepage.json" assert { type: "json" };
import pricingJson from "@/content/pricing.json" assert { type: "json" };
import faqJson from "@/content/faq.json" assert { type: "json" };
import testimonialsJson from "@/content/testimonials.json" assert { type: "json" };
import siteJson from "@/content/site.json" assert { type: "json" };

const navigationSchema = z.array(z.object({ label: z.string(), href: z.string() }));

export const siteSchema = z.object({
  productName: z.string(),
  tagline: z.string(),
  valueProp: z.string(),
  accentHex: z.string(),
  contactEmail: z.string(),
  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
  navigation: navigationSchema,
  social: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  footer: z
    .object({
      columns: z
        .array(
          z.object({
            title: z.string(),
            links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
          })
        )
        .default([]),
      copyright: z.string().optional(),
    })
    .default({ columns: [] }),
});

export const heroSchema = z.object({
  badge: z.string(),
  title: z.string(),
  subtitle: z.string(),
  primaryCta: z.object({ label: z.string(), href: z.string() }),
  secondaryCta: z.object({ label: z.string(), href: z.string() }),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
});

const mosaicTileSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"), title: z.string(), src: z.string(), span: z.string().optional() }),
  z.object({ type: z.literal("text"), title: z.string(), description: z.string(), span: z.string().optional() }),
  z.object({ type: z.literal("metric"), title: z.string(), value: z.string(), caption: z.string().optional(), span: z.string().optional() }),
]);

export const homepageSchema = z.object({
  hero: heroSchema,
  mosaic: z.object({
    shuffleInterval: z.number().optional(),
    tiles: z.array(mosaicTileSchema),
  }),
  marquee: z.object({ title: z.string().optional() }).optional(),
  featureSection: z.object({
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    features: z.array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
        href: z.string(),
      })
    ),
  }),
});

export const pricingSchema = z.object({
  currency: z.string().default("EUR"),
  toggle: z.object({ monthly: z.string(), annual: z.string() }),
  plans: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      badge: z.string().nullable(),
      price: z.object({ monthly: z.number().nullable(), annual: z.number().nullable() }),
      description: z.string(),
      features: z.array(z.string()),
      cta: z.object({ label: z.string(), href: z.string() }),
    })
  ),
  featureMatrix: z.object({
    rows: z.array(
      z.object({
        label: z.string(),
        plans: z.record(z.boolean()).default({}),
      })
    ),
  }),
});

export const faqSchema = z.object({
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export const testimonialsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      company: z.string(),
      quote: z.string(),
      avatar: z.string(),
    })
  ),
});

export const siteContent = siteSchema.parse(siteJson);
export const homepageContent = homepageSchema.parse(homepageJson);
export const pricingContent = pricingSchema.parse(pricingJson);
export const faqContent = faqSchema.parse(faqJson);
export const testimonialsContent = testimonialsSchema.parse(testimonialsJson);
