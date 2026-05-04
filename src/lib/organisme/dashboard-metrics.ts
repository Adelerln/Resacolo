type StayDashboardInput = {
  id: string;
  title: string;
  status: string | null;
  updated_at: string;
};

type SessionDashboardInput = {
  id: string;
  stay_id: string;
  capacity_total: number;
  status: string | null;
};

type StayMediaDashboardInput = {
  stay_id: string;
};

type StayVisitDashboardInput = {
  entity_id: string;
};

type OrganizerMemberDashboardInput = {
  role: string;
};

export type OrganizerDashboardStayRow = {
  id: string;
  title: string;
  status: string | null;
  updatedAt: string;
  sessionCount: number;
  reserved: number;
  capacity: number;
  mediaCount: number;
  isPublished: boolean;
  visitCount: number;
};

export type OrganizerDashboardMetrics = {
  totalStays: number;
  totalPublishedStays: number;
  totalDraftOrHiddenStays: number;
  totalReservations: number;
  totalCapacity: number;
  occupancyRate: number;
  publicationRate: number;
  mediaCoverageRate: number;
  staysWithReservationsCount: number;
  fullSessionsCount: number;
  openSessionsCount: number;
  avgReservationsPerPublishedStay: number;
  totalStayVisits: number;
  visitedStaysCount: number;
  avgVisitsPerStay: number;
  ownerCount: number;
  editorCount: number;
  reservationManagerCount: number;
};

export type OrganizerDashboardLists = {
  topStays: OrganizerDashboardStayRow[];
  noTractionPublishedStays: OrganizerDashboardStayRow[];
  vigilanceStays: OrganizerDashboardStayRow[];
};

export type OrganizerDashboardViewModel = {
  metrics: OrganizerDashboardMetrics;
  stayRows: OrganizerDashboardStayRow[];
  lists: OrganizerDashboardLists;
};

type BuildOrganizerDashboardInput = {
  stays: StayDashboardInput[];
  sessions: SessionDashboardInput[];
  stayMedia: StayMediaDashboardInput[];
  stayVisits: StayVisitDashboardInput[];
  members: OrganizerMemberDashboardInput[];
  reservedCounts: Map<string, number>;
};

export function buildOrganizerDashboardModel({
  stays,
  sessions,
  stayMedia,
  stayVisits,
  members,
  reservedCounts
}: BuildOrganizerDashboardInput): OrganizerDashboardViewModel {
  const mediaCountByStayId = new Map<string, number>();
  for (const media of stayMedia) {
    mediaCountByStayId.set(media.stay_id, (mediaCountByStayId.get(media.stay_id) ?? 0) + 1);
  }
  const visitCountByStayId = new Map<string, number>();
  for (const visitEvent of stayVisits) {
    visitCountByStayId.set(
      visitEvent.entity_id,
      (visitCountByStayId.get(visitEvent.entity_id) ?? 0) + 1
    );
  }

  const sessionCountByStayId = new Map<string, number>();
  const reservedCountByStayId = new Map<string, number>();
  const capacityByStayId = new Map<string, number>();

  let fullSessionsCount = 0;
  let openSessionsCount = 0;

  for (const sessionItem of sessions) {
    sessionCountByStayId.set(
      sessionItem.stay_id,
      (sessionCountByStayId.get(sessionItem.stay_id) ?? 0) + 1
    );

    const reservedCount = reservedCounts.get(sessionItem.id) ?? 0;
    reservedCountByStayId.set(
      sessionItem.stay_id,
      (reservedCountByStayId.get(sessionItem.stay_id) ?? 0) + reservedCount
    );

    if (sessionItem.status === 'ARCHIVED' || sessionItem.status === 'COMPLETED') continue;

    openSessionsCount += 1;

    if (sessionItem.status === 'FULL' || reservedCount >= sessionItem.capacity_total) {
      fullSessionsCount += 1;
    }
    capacityByStayId.set(
      sessionItem.stay_id,
      (capacityByStayId.get(sessionItem.stay_id) ?? 0) + sessionItem.capacity_total
    );
  }

  const stayRows = stays
    .map((stay) => {
      const reserved = reservedCountByStayId.get(stay.id) ?? 0;
      const capacity = capacityByStayId.get(stay.id) ?? 0;
      return {
        id: stay.id,
        title: stay.title,
        status: stay.status,
        updatedAt: stay.updated_at,
        sessionCount: sessionCountByStayId.get(stay.id) ?? 0,
        reserved,
        capacity,
        mediaCount: mediaCountByStayId.get(stay.id) ?? 0,
        isPublished: stay.status === 'PUBLISHED',
        visitCount: visitCountByStayId.get(stay.id) ?? 0
      };
    })
    .sort(
      (a, b) =>
        b.reserved - a.reserved || b.sessionCount - a.sessionCount || a.title.localeCompare(b.title, 'fr')
    );

  const totalStays = stayRows.length;
  const totalPublishedStays = stayRows.filter((stay) => stay.isPublished).length;
  const totalDraftOrHiddenStays = totalStays - totalPublishedStays;
  const totalReservations = Array.from(reservedCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalCapacity = Array.from(capacityByStayId.values()).reduce((sum, count) => sum + count, 0);
  const occupancyRate = totalCapacity > 0 ? (totalReservations / totalCapacity) * 100 : 0;
  const publicationRate = totalStays > 0 ? (totalPublishedStays / totalStays) * 100 : 0;
  const mediaCoverageRate =
    totalStays > 0 ? (stayRows.filter((stay) => stay.mediaCount > 0).length / totalStays) * 100 : 0;
  const staysWithReservationsCount = stayRows.filter((stay) => stay.reserved > 0).length;
  const avgReservationsPerPublishedStay =
    totalPublishedStays > 0 ? totalReservations / totalPublishedStays : 0;
  const totalStayVisits = stayRows.reduce((sum, stay) => sum + stay.visitCount, 0);
  const visitedStaysCount = stayRows.filter((stay) => stay.visitCount > 0).length;
  const avgVisitsPerStay = totalStays > 0 ? totalStayVisits / totalStays : 0;

  const ownerCount = members.filter((member) => member.role === 'OWNER').length;
  const editorCount = members.filter((member) => member.role === 'EDITOR').length;
  const reservationManagerCount = members.filter(
    (member) => member.role === 'RESERVATION_MANAGER'
  ).length;

  const topStays = stayRows.filter((stay) => stay.reserved > 0).slice(0, 5);
  const noTractionPublishedStays = stayRows
    .filter((stay) => stay.isPublished)
    .sort(
      (a, b) =>
        b.visitCount - a.visitCount ||
        b.sessionCount - a.sessionCount ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.title.localeCompare(b.title, 'fr')
    )
    .slice(0, 5);
  const vigilanceStays = stayRows
    .filter((stay) => stay.capacity === 0)
    .sort((a, b) => b.reserved - a.reserved || a.title.localeCompare(b.title, 'fr'))
    .slice(0, 5);

  return {
    metrics: {
      totalStays,
      totalPublishedStays,
      totalDraftOrHiddenStays,
      totalReservations,
      totalCapacity,
      occupancyRate,
      publicationRate,
      mediaCoverageRate,
      staysWithReservationsCount,
      fullSessionsCount,
      openSessionsCount,
      avgReservationsPerPublishedStay,
      totalStayVisits,
      visitedStaysCount,
      avgVisitsPerStay,
      ownerCount,
      editorCount,
      reservationManagerCount
    },
    stayRows,
    lists: {
      topStays,
      noTractionPublishedStays,
      vigilanceStays
    }
  };
}
