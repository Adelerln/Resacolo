import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { AlertService } from '@/lib/domain/services/alertService';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const organizerTenantId = searchParams.get('organizerTenantId');
  const seasonId = searchParams.get('seasonId');
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: organizerTenantId,
    requiredSection: 'dashboard'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (!organizerTenantId || !seasonId) {
    return NextResponse.json(
      { error: 'organizerTenantId and seasonId are required' },
      { status: 400 }
    );
  }

  const service = new AlertService();
  const alerts = await service.getOrganizerAlerts(organizerTenantId, seasonId);
  return NextResponse.json(alerts);
}
