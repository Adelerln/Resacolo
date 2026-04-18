import { prisma } from '@/lib/db';
import { getStayCanonicalPath, getStays } from '@/lib/stays';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { serializeRedactedObject } from '@/lib/rag/pii';
import type { RagDocumentInput } from '@/lib/rag/types';

type StaySessionRow = {
  id: string;
  stay_id: string;
  start_date: string;
  end_date: string;
  status: string;
  capacity_total: number;
  capacity_reserved: number;
};

function trimOrNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function toMultilineRecord(record: Record<string, unknown>) {
  return serializeRedactedObject(record);
}

async function extractOrganizers(): Promise<RagDocumentInput[]> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('organizers')
    .select(
      'id,name,slug,description,hero_intro_text,website_url,contact_email,founded_year,age_min,age_max,season_keys,stay_type_keys,activity_keys,is_resacolo_member,is_founding_member,profile_completeness_percent'
    )
    .order('name', { ascending: true });

  return (data ?? []).map((row) => {
    const slug = trimOrNull(row.slug) ?? slugify(row.name);
    const sourceUrl = slug ? `/organisateurs/${slug}` : null;
    const title = `Organisateur: ${row.name}`;
    const content = toMultilineRecord({
      type: 'organizer',
      name: row.name,
      slug,
      website_url: row.website_url,
      contact_email: row.contact_email,
      description: row.description,
      hero_intro_text: row.hero_intro_text,
      founded_year: row.founded_year,
      age_min: row.age_min,
      age_max: row.age_max,
      season_keys: row.season_keys,
      stay_type_keys: row.stay_type_keys,
      activity_keys: row.activity_keys,
      is_resacolo_member: row.is_resacolo_member,
      is_founding_member: row.is_founding_member,
      profile_completeness_percent: row.profile_completeness_percent
    });

    return {
      sourceRef: `organizer:${row.id}`,
      sourceType: 'organizer',
      sourceId: row.id,
      sourceUrl,
      title,
      metadata: {
        name: row.name,
        slug,
        source_table: 'organizers',
        has_public_page: Boolean(sourceUrl)
      },
      content
    } satisfies RagDocumentInput;
  });
}

async function extractStays(): Promise<RagDocumentInput[]> {
  const supabase = getServerSupabaseClient();
  const { data: stays } = await supabase
    .from('stays')
    .select(
      'id,title,status,summary,description,activities_text,program_text,transport_text,supervision_text,required_documents_text,location_text,region_text,ages,age_min,age_max,season_id,organizer_id,transport_mode,partner_discount_percent,source_url,updated_at,created_at'
    )
    .order('updated_at', { ascending: false });

  const stayRows = stays ?? [];
  if (!stayRows.length) return [];

  const organizerIds = Array.from(new Set(stayRows.map((row) => row.organizer_id)));
  const seasonIds = Array.from(new Set(stayRows.map((row) => row.season_id)));
  const stayIds = stayRows.map((row) => row.id);

  const [{ data: organizers }, { data: seasons }, { data: sessions }, publishedStays] = await Promise.all([
    supabase.from('organizers').select('id,name,slug').in('id', organizerIds),
    supabase.from('seasons').select('id,name,start_date,end_date').in('id', seasonIds),
    supabase
      .from('sessions')
      .select('id,stay_id,start_date,end_date,status,capacity_total,capacity_reserved')
      .in('stay_id', stayIds),
    getStays().catch(() => [])
  ]);

  const organizerById = new Map((organizers ?? []).map((row) => [row.id, row]));
  const seasonById = new Map((seasons ?? []).map((row) => [row.id, row]));
  const sessionRows = (sessions ?? []) as StaySessionRow[];
  const sessionsByStayId = new Map<string, StaySessionRow[]>();
  for (const session of sessionRows) {
    const group = sessionsByStayId.get(session.stay_id) ?? [];
    group.push(session);
    sessionsByStayId.set(session.stay_id, group);
  }

  const canonicalPathByStayId = new Map(
    publishedStays.map((stay) => [stay.id, getStayCanonicalPath(stay)])
  );

  return stayRows.map((row) => {
    const organizer = organizerById.get(row.organizer_id);
    const season = seasonById.get(row.season_id);
    const rowSessions = sessionsByStayId.get(row.id) ?? [];
    const sourceUrl = canonicalPathByStayId.get(row.id) ?? trimOrNull(row.source_url) ?? null;
    const title = `Séjour: ${row.title}`;
    const content = toMultilineRecord({
      type: 'stay',
      id: row.id,
      title: row.title,
      status: row.status,
      organizer: organizer?.name ?? row.organizer_id,
      season: season?.name ?? row.season_id,
      summary: row.summary,
      description: row.description,
      activities_text: row.activities_text,
      program_text: row.program_text,
      supervision_text: row.supervision_text,
      transport_text: row.transport_text,
      required_documents_text: row.required_documents_text,
      location_text: row.location_text,
      region_text: row.region_text,
      ages: row.ages,
      age_min: row.age_min,
      age_max: row.age_max,
      transport_mode: row.transport_mode,
      partner_discount_percent: row.partner_discount_percent,
      sessions: rowSessions
    });

    return {
      sourceRef: `stay:${row.id}`,
      sourceType: 'stay',
      sourceId: row.id,
      sourceUrl,
      title,
      metadata: {
        status: row.status,
        organizer_id: row.organizer_id,
        organizer_name: organizer?.name ?? null,
        season_id: row.season_id,
        season_name: season?.name ?? null,
        source_table: 'stays',
        has_public_page: Boolean(sourceUrl)
      },
      content
    } satisfies RagDocumentInput;
  });
}

async function extractCollectivities(): Promise<RagDocumentInput[]> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('collectivities')
    .select('id,name,code,offer_mode,logo_url,created_at')
    .order('name', { ascending: true });

  return (data ?? []).map((row) => ({
    sourceRef: `collectivity:${row.id}`,
    sourceType: 'collectivity',
    sourceId: row.id,
    sourceUrl: null,
    title: `Partenaire: ${row.name}`,
    metadata: {
      code: row.code,
      offer_mode: row.offer_mode,
      source_table: 'collectivities'
    },
    content: toMultilineRecord({
      type: 'collectivity',
      id: row.id,
      name: row.name,
      code: row.code,
      offer_mode: row.offer_mode,
      logo_url: row.logo_url,
      created_at: row.created_at
    })
  }));
}

async function extractInquiries(): Promise<RagDocumentInput[]> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('inquiries')
    .select(
      'id,status,inquiry_type,subject,message,contact_name,contact_email,contact_phone,internal_notes,assigned_to_user_id,created_at,updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(500);

  return (data ?? []).map((row) => ({
    sourceRef: `inquiry:${row.id}`,
    sourceType: 'inquiry',
    sourceId: row.id,
    sourceUrl: null,
    title: `Demande: ${trimOrNull(row.subject) ?? row.inquiry_type ?? row.id}`,
    metadata: {
      status: row.status,
      inquiry_type: row.inquiry_type,
      source_table: 'inquiries'
    },
    content: toMultilineRecord({
      type: 'inquiry',
      id: row.id,
      status: row.status,
      inquiry_type: row.inquiry_type,
      subject: row.subject,
      message: row.message,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      assigned_to_user_id: row.assigned_to_user_id,
      internal_notes: row.internal_notes,
      created_at: row.created_at,
      updated_at: row.updated_at
    })
  }));
}

async function extractSupportRequests(): Promise<RagDocumentInput[]> {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from('organizer_support_requests')
    .select(
      'id,organizer_id,status,priority,category,subject,body,assigned_to_user_id,created_by_user_id,resolved_at,created_at,updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(500);

  const requests = data ?? [];
  const organizerIds = Array.from(new Set(requests.map((row) => row.organizer_id)));
  const { data: organizers } = organizerIds.length
    ? await supabase.from('organizers').select('id,name').in('id', organizerIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const organizerById = new Map((organizers ?? []).map((row) => [row.id, row.name]));

  return requests.map((row) => ({
    sourceRef: `support_request:${row.id}`,
    sourceType: 'support_request',
    sourceId: row.id,
    sourceUrl: null,
    title: `Support: ${trimOrNull(row.subject) ?? row.id}`,
    metadata: {
      status: row.status,
      priority: row.priority,
      organizer_id: row.organizer_id,
      organizer_name: organizerById.get(row.organizer_id) ?? null,
      source_table: 'organizer_support_requests'
    },
    content: toMultilineRecord({
      type: 'support_request',
      id: row.id,
      organizer_id: row.organizer_id,
      organizer_name: organizerById.get(row.organizer_id) ?? null,
      status: row.status,
      priority: row.priority,
      category: row.category,
      subject: row.subject,
      body: row.body,
      assigned_to_user_id: row.assigned_to_user_id,
      created_by_user_id: row.created_by_user_id,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    })
  }));
}

async function extractPrismaPartnerAndOps(): Promise<RagDocumentInput[]> {
  if (process.env.MOCK_UI === '1') return [];

  try {
    const [partnerTenants, assortments, requests] = await Promise.all([
      prisma.tenant.findMany({
        where: { type: 'PARTNER' },
        include: { partnerConfig: true },
        orderBy: { updatedAt: 'desc' },
        take: 300
      }),
      prisma.assortment.findMany({
        include: {
          season: true,
          partnerTenant: true,
          items: true
        },
        orderBy: { updatedAt: 'desc' },
        take: 300
      }),
      prisma.request.findMany({
        include: {
          currentStage: true,
          partnerTenant: true,
          stay: {
            select: {
              id: true,
              title: true,
              status: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 500
      })
    ]);

    const docs: RagDocumentInput[] = [];

    for (const tenant of partnerTenants) {
      docs.push({
        sourceRef: `partner_tenant:${tenant.id}`,
        sourceType: 'partner_tenant',
        sourceId: tenant.id,
        sourceUrl: null,
        title: `Tenant partenaire: ${tenant.name}`,
        metadata: {
          slug: tenant.slug,
          status: tenant.status,
          source_table: 'Tenant'
        },
        content: toMultilineRecord({
          type: 'partner_tenant',
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          created_at: tenant.createdAt,
          updated_at: tenant.updatedAt
        })
      });

      if (tenant.partnerConfig) {
        docs.push({
          sourceRef: `partner_config:${tenant.partnerConfig.id}`,
          sourceType: 'partner_config',
          sourceId: tenant.partnerConfig.id,
          sourceUrl: null,
          title: `Configuration partenaire: ${tenant.name}`,
          metadata: {
            tenant_id: tenant.id,
            source_table: 'PartnerConfig'
          },
          content: toMultilineRecord({
            type: 'partner_config',
            id: tenant.partnerConfig.id,
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            brand_name: tenant.partnerConfig.brandName,
            logo_url: tenant.partnerConfig.logoUrl,
            colors_json: tenant.partnerConfig.colorsJson,
            default_filters_json: tenant.partnerConfig.defaultFiltersJson,
            eligibility_rules_json: tenant.partnerConfig.eligibilityRulesJson,
            subsidies_json: tenant.partnerConfig.subsidiesJson,
            code_rules_json: tenant.partnerConfig.codeRulesJson
          })
        });
      }
    }

    for (const assortment of assortments) {
      docs.push({
        sourceRef: `assortment:${assortment.id}`,
        sourceType: 'assortment',
        sourceId: assortment.id,
        sourceUrl: null,
        title: `Catalogue partenaire: ${assortment.name}`,
        metadata: {
          partner_tenant_id: assortment.partnerTenantId,
          season_id: assortment.seasonId,
          status: assortment.status,
          source_table: 'Assortment'
        },
        content: toMultilineRecord({
          type: 'assortment',
          id: assortment.id,
          name: assortment.name,
          status: assortment.status,
          season: assortment.season?.name ?? null,
          partner_tenant: assortment.partnerTenant?.name ?? null,
          items: assortment.items.map((item) => ({
            id: item.id,
            type: item.type,
            target_ref: item.targetRef,
            include: item.include,
            priority: item.priority
          })),
          created_at: assortment.createdAt,
          updated_at: assortment.updatedAt
        })
      });
    }

    for (const request of requests) {
      docs.push({
        sourceRef: `request:${request.id}`,
        sourceType: 'request',
        sourceId: request.id,
        sourceUrl: null,
        title: `Demande opérationnelle: ${request.id}`,
        metadata: {
          partner_tenant_id: request.partnerTenantId,
          stay_id: request.stayId,
          stage: request.currentStage?.key ?? null,
          source_table: 'Request'
        },
        content: toMultilineRecord({
          type: 'request',
          id: request.id,
          stay_id: request.stayId,
          stay_title: request.stay?.title ?? null,
          stay_status: request.stay?.status ?? null,
          partner_tenant_id: request.partnerTenantId,
          partner_tenant_name: request.partnerTenant?.name ?? null,
          season_id: request.seasonId,
          current_stage: request.currentStage
            ? {
                id: request.currentStage.id,
                key: request.currentStage.key,
                label: request.currentStage.label
              }
            : null,
          notes: request.notes,
          applicant_json: request.applicantJson,
          created_at: request.createdAt,
          updated_at: request.updatedAt
        })
      });
    }

    return docs;
  } catch (error) {
    console.warn('[rag/extractors] Prisma data unavailable:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function collectAllRagDocuments(): Promise<RagDocumentInput[]> {
  const [organizers, stays, collectivities, inquiries, support, prismaDocs] = await Promise.all([
    extractOrganizers(),
    extractStays(),
    extractCollectivities(),
    extractInquiries(),
    extractSupportRequests(),
    extractPrismaPartnerAndOps()
  ]);

  return [...organizers, ...stays, ...collectivities, ...inquiries, ...support, ...prismaDocs];
}

export async function collectRagDocumentsForSourceRefs(sourceRefs: string[]) {
  const wanted = new Set(sourceRefs);
  if (!wanted.size) return [];
  const docs = await collectAllRagDocuments();
  return docs.filter((doc) => wanted.has(doc.sourceRef));
}
