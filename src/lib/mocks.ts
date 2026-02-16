export const mockSeasons = [
  { id: 'season-ete-2026', name: 'Ete 2026' }
];

export const mockOrganizerTenant = { id: 'tenant-org-1', name: 'Alpha Organisateur' };
export const mockPartnerTenant = { id: 'tenant-partner-1', name: 'CSE Horizon' };

export const mockStays = [
  {
    id: 'stay-1',
    title: 'Aventure en montagne',
    status: 'PUBLISHED',
    qualityScore: 78,
    seasonId: 'season-ete-2026',
    organizerTenantId: 'tenant-org-1',
    location: 'Alpes',
    ageMin: 12,
    ageMax: 16,
    description: 'Un sejour sportif pour les ados.'
  },
  {
    id: 'stay-2',
    title: 'Stage ocean',
    status: 'PENDING',
    qualityScore: 62,
    seasonId: 'season-ete-2026',
    organizerTenantId: 'tenant-org-1',
    location: 'Biarritz',
    ageMin: 8,
    ageMax: 12,
    description: 'Surf et ocean.'
  }
];

export const mockSessions = [
  {
    id: 'session-1',
    stayId: 'stay-1',
    startDate: new Date('2026-07-05'),
    endDate: new Date('2026-07-19'),
    capacityTotal: 30,
    capacityReserved: 12,
    status: 'OPEN'
  },
  {
    id: 'session-2',
    stayId: 'stay-1',
    startDate: new Date('2026-08-02'),
    endDate: new Date('2026-08-16'),
    capacityTotal: 25,
    capacityReserved: 20,
    status: 'NEAR_FULL'
  }
];

export const mockStages = [
  { id: 'stage-1', label: 'Nouvelle' },
  { id: 'stage-2', label: 'Qualifiee' },
  { id: 'stage-3', label: 'Transmise organisateur' },
  { id: 'stage-4', label: 'En cours' },
  { id: 'stage-5', label: 'Finalisee' },
  { id: 'stage-6', label: 'Perdue' }
];

export const mockRequests = [
  {
    id: 'req-1',
    stayId: 'stay-1',
    sessionId: 'session-1',
    partnerTenantId: 'tenant-partner-1',
    currentStageId: 'stage-2'
  }
];

export const mockUsers = [
  {
    id: 'user-1',
    name: 'Admin Resacolo',
    email: 'admin@resacolo.com',
    roles: ['PLATFORM_ADMIN']
  },
  {
    id: 'user-2',
    name: 'Nora Organisateur',
    email: 'orga@resacolo.com',
    roles: ['ORGANIZER_ADMIN']
  },
  {
    id: 'user-3',
    name: 'Paul Partenaire',
    email: 'partenaire@resacolo.com',
    roles: ['PARTNER_ADMIN']
  }
];
