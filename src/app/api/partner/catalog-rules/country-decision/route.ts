import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { requireApiAuth } from '@/lib/auth/api';
import {
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules
} from '@/lib/partner-catalog-rules';
import { applyCountryDecision } from '@/lib/partner-catalog-countries';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { buildFeatureActivationMessage, isMissingColumnError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (
    session.role !== 'PARTENAIRE' ||
    !session.tenantId ||
    !canAccessPartnerSection(getPartnerAccessRoleFromSession(session), 'catalog')
  ) {
    return NextResponse.json({ errors: ['FORBIDDEN'] }, { status: 403 });
  }

  let body: { country?: string; decision?: string } = {};
  try {
    body = (await req.json()) as { country?: string; decision?: string };
  } catch {
    return NextResponse.json({ errors: ['INVALID_JSON'] }, { status: 400 });
  }

  const country = String(body.country ?? '').trim();
  const decision = body.decision === 'excluded' ? 'excluded' : body.decision === 'allowed' ? 'allowed' : null;
  if (!country || !decision) {
    return NextResponse.json({ errors: ['INVALID_INPUT'] }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const { data, error: readError } = await supabase
    .from('collectivities')
    .select('catalog_rules_draft')
    .eq('id', session.tenantId)
    .maybeSingle();

  if (readError) {
    if (isMissingColumnError(readError, 'catalog_rules_draft')) {
      return NextResponse.json(
        { errors: [buildFeatureActivationMessage('Le catalogue partenaire')] },
        { status: 503 }
      );
    }
    return NextResponse.json({ errors: [readError.message] }, { status: 500 });
  }

  const currentRules = normalizePartnerCatalogRules(
    data?.catalog_rules_draft ?? getDefaultPartnerCatalogRules()
  );
  const nextRules = applyCountryDecision(currentRules, country, decision);

  let validated;
  try {
    validated = parseAndValidatePartnerCatalogRules(nextRules);
  } catch (error) {
    return NextResponse.json(
      { errors: [error instanceof Error ? error.message : 'RULES_INVALID'] },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from('collectivities')
    .update({
      catalog_rules_draft: validated,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.tenantId);

  if (updateError) {
    if (isMissingColumnError(updateError, 'catalog_rules_draft')) {
      return NextResponse.json(
        { errors: [buildFeatureActivationMessage('L’enregistrement du catalogue')] },
        { status: 503 }
      );
    }
    return NextResponse.json({ errors: [updateError.message] }, { status: 500 });
  }

  revalidatePath('/partenaire');
  revalidatePath('/partenaire/catalogue');

  return NextResponse.json({
    data: {
      country,
      decision,
      draft: validated
    },
    errors: []
  });
}
