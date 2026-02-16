import { prisma } from '@/lib/db';

export type AlertItem = {
  code: string;
  level: 'info' | 'warning';
  message: string;
  stayId?: string;
  sessionId?: string;
};

export class AlertService {
  async getOrganizerAlerts(organizerTenantId: string, seasonId: string) {
    const alerts: AlertItem[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stays = await prisma.stay.findMany({
      where: { organizerTenantId, seasonId, status: 'PUBLISHED' },
      include: {
        sessions: true,
        requests: { where: { createdAt: { gte: thirtyDaysAgo } } }
      }
    });

    for (const stay of stays) {
      if (stay.requests.length === 0) {
        alerts.push({
          code: 'NO_REQUESTS_30D',
          level: 'warning',
          message: 'Séjour sans demande depuis 30 jours.',
          stayId: stay.id
        });
      }

      const allClosed =
        stay.sessions.length > 0 &&
        stay.sessions.every((s: { status: string }) => s.status === 'CLOSED');
      if (allClosed) {
        alerts.push({
          code: 'SUGGEST_NEW_SESSION',
          level: 'info',
          message: 'Toutes les sessions sont pleines. Envisager une nouvelle session.',
          stayId: stay.id
        });
      }

      for (const session of stay.sessions) {
        if (session.capacityTotal > 0 && session.capacityReserved / session.capacityTotal >= 0.9) {
          alerts.push({
            code: 'SESSION_NEAR_FULL',
            level: 'info',
          message: 'Session bientôt pleine.',
            stayId: stay.id,
            sessionId: session.id
          });
        }
      }
    }

    const outOfSeasonSessions = await prisma.staySession.findMany({
      where: {
        seasonId,
        stay: { organizerTenantId }
      },
      include: { season: true }
    });

    for (const session of outOfSeasonSessions) {
      if (session.startDate < session.season.startsAt || session.endDate > session.season.endsAt) {
        alerts.push({
          code: 'SEASON_INCOHERENT',
          level: 'warning',
          message: 'Session en dehors des dates de la saison.',
          sessionId: session.id
        });
      }
    }

    return alerts;
  }
}
