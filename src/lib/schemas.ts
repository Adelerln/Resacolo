import { z } from 'zod';

export const StaySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  canonicalSlug: z.string(),
  legacySlugs: z.array(z.string()).optional(),
  summary: z.string(),
  description: z.string(),
  organizer: z.object({
    name: z.string(),
    website: z.string().url().or(z.literal('')),
    slug: z.string().optional(),
    logoUrl: z.string().url().optional(),
    description: z.string().optional()
  }),
  location: z.string(),
  region: z.string(),
  country: z.string(),
  ageRange: z.string(),
  duration: z.string(),
  priceFrom: z.number().nullable(),
  period: z.array(z.string()),
  categories: z.array(z.string()),
  highlights: z.array(z.string()),
  coverImage: z.string().url().optional(),
  filters: z.object({
    categories: z.array(z.string()),
    audiences: z.array(z.string()),
    durations: z.array(z.string()),
    periods: z.array(z.string()),
    priceRange: z.tuple([z.number(), z.number()]).nullable(),
    transport: z.array(z.string())
  }),
  seo: z
    .object({
      primaryKeyword: z.string().optional(),
      secondaryKeywords: z.array(z.string()),
      targetCity: z.string().optional(),
      targetRegion: z.string().optional(),
      searchIntents: z.array(z.string()),
      title: z.string().optional(),
      metaDescription: z.string().optional(),
      introText: z.string().optional(),
      h1Variant: z.string().optional(),
      internalLinkAnchorSuggestions: z.array(z.string()).optional(),
      slugCandidate: z.string().optional(),
      score: z.number().int().optional(),
      checks: z
        .array(
          z.object({
            code: z.string(),
            level: z.enum(['ok', 'warning', 'info']),
            message: z.string()
          })
        )
        .optional(),
      generatedAt: z.string().optional(),
      generationSource: z.string().optional()
    })
    .optional(),
  sourceUrl: z.string().url().optional(),
  rawContext: z.record(z.any()).optional(),
  updatedAt: z.string()
});

export const StayCollectionSchema = z.object({
  stays: z.array(StaySchema)
});

export type StayPayload = z.infer<typeof StaySchema>;
