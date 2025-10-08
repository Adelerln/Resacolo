import { cache } from 'react';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createOpenAIClient } from '@/lib/openai';
import { FILTER_LABELS, ORGANIZERS } from '@/lib/constants';
import { StayCollectionSchema, StayPayload } from '@/lib/schemas';
import sampleData from '@/data/sample-stays.json';
import type { Stay, StayAudience, StayCategory, StayDuration, StayFilters as StayFiltersMeta, StaySearchParams } from '@/types/stay';

type StayPeriod = StayFiltersMeta['periods'][number];
type StayTransport = StayFiltersMeta['transport'][number];

const OPENAI_MODEL = 'gpt-4.1';

const StayJsonSchema = {
  name: 'stay_collection',
  schema: {
    type: 'object',
    properties: {
      stays: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            organizer: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                website: { type: 'string' },
                logoUrl: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['name', 'website']
            },
            location: { type: 'string' },
            country: { type: 'string' },
            ageRange: { type: 'string' },
            duration: { type: 'string' },
            priceFrom: { type: ['number', 'null'] },
            period: {
              type: 'array',
              items: { type: 'string' }
            },
            categories: {
              type: 'array',
              items: { type: 'string' }
            },
            highlights: {
              type: 'array',
              items: { type: 'string' }
            },
            coverImage: { type: 'string' },
            filters: {
              type: 'object',
              properties: {
                categories: { type: 'array', items: { type: 'string' } },
                audiences: { type: 'array', items: { type: 'string' } },
                durations: { type: 'array', items: { type: 'string' } },
                periods: { type: 'array', items: { type: 'string' } },
                priceRange: { type: ['array', 'null'] },
                transport: { type: 'array', items: { type: 'string' } }
              },
              required: ['categories', 'audiences', 'durations', 'periods', 'priceRange', 'transport']
            },
            sourceUrl: { type: 'string' },
            rawContext: { type: 'object' },
            updatedAt: { type: 'string' }
          },
          required: [
            'id',
            'title',
            'slug',
            'summary',
            'description',
            'organizer',
            'location',
            'country',
            'ageRange',
            'duration',
            'priceFrom',
            'period',
            'categories',
            'highlights',
            'filters',
            'updatedAt'
          ]
        }
      }
    },
    required: ['stays'],
    additionalProperties: false
  }
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapToTaxonomy<Keys extends string>(values: string[], allowed: Record<Keys, string>): Keys[] {
  const lowered = values.map((value) => value.toLowerCase().trim());
  const allowedKeys = Object.keys(allowed) as Keys[];

  return Array.from(
    new Set(
      lowered
        .map((value) => allowedKeys.find((key) => value.includes(key) || key.includes(value)))
        .filter((value): value is Keys => Boolean(value))
    )
  );
}

function normalisePayload(payload: StayPayload): Stay {
  const categories = mapToTaxonomy(payload.categories, FILTER_LABELS.categories);
  const periods = mapToTaxonomy(payload.period, FILTER_LABELS.periods);
  const audiences = mapToTaxonomy(payload.filters.audiences, FILTER_LABELS.audiences);
  const durations = mapToTaxonomy(payload.filters.durations, FILTER_LABELS.durations);
  const transport = mapToTaxonomy(payload.filters.transport, FILTER_LABELS.transport);

  const fallbackCategory: StayCategory = 'multi-activites';
  const fallbackAudience: StayAudience = '10-12';
  const fallbackDuration: StayDuration = 'semaine';
  const fallbackPeriod: StayPeriod = 'ete';
  const fallbackTransport: StayTransport = 'depart-region';

  return {
    ...payload,
    slug: payload.slug || slugify(`${payload.organizer.name}-${payload.title}`),
    categories: (categories.length ? categories : [fallbackCategory]) as Stay['categories'],
    period: periods.length ? periods : [fallbackPeriod],
    filters: {
      ...payload.filters,
      categories: categories.length ? categories : [fallbackCategory],
      audiences: audiences.length ? audiences : [fallbackAudience],
      durations: durations.length ? durations : [fallbackDuration],
      periods: periods.length ? periods : [fallbackPeriod],
      transport: transport.length ? transport : [fallbackTransport]
    }
  };
}

async function extractStaysFromOrganizer(html: string, organizer: { name: string; website: string }) {
  const client = createOpenAIClient();

const instructions = `Analyse le contenu HTML suivant provenant du site de ${organizer.name} (${organizer.website}).
Identifie jusqu'à 8 offres de séjours destinés aux enfants et pré-adolescents.
Pour chaque séjour, fournis une fiche structurée claire qui sera affichée sur la plateforme.
Renseigne uniquement des informations présentes ou déductibles du site.
Complète strictement la taxonomie fournie :
- categories possibles: nature, sport, culture, langues, mer, montagne, multi-activites, solidarite, science, arts
- audiences possibles: 6-9, 10-12, 13-15, 16-17
- durations possibles: mini-sejour, semaine, quinzaine, long
- periods possibles: hiver, printemps, ete, automne, toussaint
- transport possibles: depart-paris, depart-region, sans-transport
`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Tu es un assistant qui transforme du HTML en fiches de séjours structurées pour la plateforme. Respecte scrupuleusement les schémas JSON fournis.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: instructions },
          {
            type: 'input_text',
            text: html.slice(0, 60000)
          }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: StayJsonSchema
    },
    temperature: 0.4
  } as any);

  const jsonOutput = response.output
    ?.map((item) => ('content' in item ? item.content : []))
    .flat()
    .find((item) => item.type === 'output_text');

  if (!jsonOutput || jsonOutput.type !== 'output_text') {
    throw new Error('Réponse OpenAI invalide');
  }

  const parsed = StayCollectionSchema.safeParse(JSON.parse(jsonOutput.text));
  if (!parsed.success) {
    throw new Error(`Schéma JSON invalide: ${parsed.error.message}`);
  }

  return parsed.data.stays.map((stay) =>
    normalisePayload({
      ...stay,
      organizer: {
        ...stay.organizer,
        name: stay.organizer.name || organizer.name,
        website: stay.organizer.website || organizer.website
      },
      sourceUrl: stay.sourceUrl ?? organizer.website
    })
  );
}

async function fetchOrganizerHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'StayAggregatorBot/1.0'
    },
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer ${url}: ${response.statusText}`);
  }

  return response.text();
}

async function generateAllStays(): Promise<Stay[]> {
  try {
    const results = await Promise.allSettled(
      ORGANIZERS.map(async (organizer) => {
        const html = await fetchOrganizerHtml(organizer.website);
        return extractStaysFromOrganizer(html, organizer);
      })
    );

    const stays = results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .map((stay) => ({ ...stay, updatedAt: new Date().toISOString() }));

    if (!stays.length) {
      const fallback = StayCollectionSchema.parse(sampleData);
      return fallback.stays.map((stay) =>
        normalisePayload({
          ...stay,
          updatedAt: stay.updatedAt || new Date().toISOString()
        })
      );
    }

    return stays;
  } catch (error) {
    console.error('Erreur durant la génération des séjours', error);
    const fallback = StayCollectionSchema.parse(sampleData);
    return fallback.stays.map((stay) =>
      normalisePayload({
        ...stay,
        updatedAt: stay.updatedAt || new Date().toISOString()
      })
    );
  }
}

const loadStays = cache(async () => generateAllStays());

export async function getStays(options: { forceRefresh?: boolean } = {}) {
  if (options.forceRefresh) {
    return generateAllStays();
  }
  return loadStays();
}

export function filterStays(stays: Stay[], params: StaySearchParams = {}) {
  return stays.filter((stay) => {
    if (params.q) {
      const haystack = `${stay.title} ${stay.summary} ${stay.description}`.toLowerCase();
      if (!haystack.includes(params.q.toLowerCase())) {
        return false;
      }
    }

    if (params.categories?.length) {
      if (!params.categories.some((category) => stay.filters.categories.includes(category))) {
        return false;
      }
    }

    if (params.audiences?.length) {
      if (!params.audiences.some((audience) => stay.filters.audiences.includes(audience))) {
        return false;
      }
    }

    if (params.durations?.length) {
      if (!params.durations.some((duration) => stay.filters.durations.includes(duration))) {
        return false;
      }
    }

    if (params.periods?.length) {
      if (!params.periods.some((period) => stay.filters.periods.includes(period))) {
        return false;
      }
    }

    if (params.priceMax) {
      if (stay.priceFrom && stay.priceFrom > params.priceMax) {
        return false;
      }
    }

    if (params.organizer) {
      if (!stay.organizer.name.toLowerCase().includes(params.organizer.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

export function buildQueryFromRequest(req: NextRequest): StaySearchParams {
  const searchParams = req.nextUrl.searchParams;
  const parseList = (key: string) => searchParams.getAll(key).flatMap((item) => item.split(',').map((value) => value.trim()).filter(Boolean));

  const audiences = parseList('audiences') as StaySearchParams['audiences'];
  const categories = parseList('categories') as StaySearchParams['categories'];
  const durations = parseList('durations') as StaySearchParams['durations'];
  const periods = parseList('periods') as StaySearchParams['periods'];

  const priceMaxRaw = searchParams.get('priceMax');
  const priceMax = priceMaxRaw ? Number.parseInt(priceMaxRaw, 10) : undefined;

  const organizer = searchParams.get('organizer') || undefined;
  const q = searchParams.get('q') || undefined;

  return {
    q,
    audiences: audiences?.length ? audiences : undefined,
    categories: categories?.length ? categories : undefined,
    durations: durations?.length ? durations : undefined,
    periods: periods?.length ? periods : undefined,
    priceMax: Number.isFinite(priceMax) ? priceMax : undefined,
    organizer
  };
}
