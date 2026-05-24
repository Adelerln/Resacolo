import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api';
import {
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules,
  simulatePartnerAid
} from '@/lib/partner-catalog-rules';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (session.role !== 'PARTENAIRE') {
    return NextResponse.json({ errors: ['FORBIDDEN'], warnings: [] }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ['INVALID_JSON'], warnings: [] }, { status: 400 });
  }

  const input = (body ?? {}) as {
    rules?: unknown;
    priceCents?: number;
    durationDays?: number;
    qfValue?: number | null;
  };

  let rules;
  try {
    rules = parseAndValidatePartnerCatalogRules(normalizePartnerCatalogRules(input.rules ?? {}));
  } catch (error) {
    return NextResponse.json(
      { errors: [error instanceof Error ? error.message : 'RULES_INVALID'], warnings: [] },
      { status: 400 }
    );
  }

  const result = simulatePartnerAid({
    rules,
    priceCents: Number(input.priceCents ?? 0),
    durationDays: Math.max(1, Number(input.durationDays ?? 1)),
    qfValue: input.qfValue == null ? null : Number(input.qfValue)
  });

  return NextResponse.json({
    data: result,
    errors: [],
    warnings: result.warnings
  });
}
