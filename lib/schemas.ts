import { z } from 'zod';

export const StaySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  description: z.string(),
  organizer: z.object({
    name: z.string(),
    website: z.string().url(),
    logoUrl: z.string().url().optional(),
    description: z.string().optional()
  }),
  location: z.string(),
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
  sourceUrl: z.string().url().optional(),
  rawContext: z.record(z.any()).optional(),
  updatedAt: z.string()
});

export const StayCollectionSchema = z.object({
  stays: z.array(StaySchema)
});

export type StayPayload = z.infer<typeof StaySchema>;
