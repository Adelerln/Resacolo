const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ITERATIONS = 120000;
const KEYLEN = 32;
const DIGEST = 'sha256';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

async function main() {
  await prisma.requestEvent.deleteMany();
  await prisma.request.deleteMany();
  await prisma.assortmentItem.deleteMany();
  await prisma.assortment.deleteMany();
  await prisma.stayPrice.deleteMany();
  await prisma.staySession.deleteMany();
  await prisma.stayMedia.deleteMany();
  await prisma.stayOption.deleteMany();
  await prisma.stayTaxonomy.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.requestStage.deleteMany();
  await prisma.organizerProfile.deleteMany();
  await prisma.partnerConfig.deleteMany();
  await prisma.tenantUser.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.season.deleteMany();

  const season = await prisma.season.create({
    data: {
      name: 'Ete 2026',
      startsAt: new Date('2026-06-15'),
      endsAt: new Date('2026-09-15')
    }
  });

  const organizerTenant = await prisma.tenant.create({
    data: {
      type: 'ORGANIZER',
      name: 'Alpha Organisateur',
      slug: 'alpha-organisateur'
    }
  });

  const partnerTenant = await prisma.tenant.create({
    data: {
      type: 'PARTNER',
      name: 'CSE Horizon',
      slug: 'cse-horizon'
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Resacolo',
      email: 'admin@resacolo.com',
      passwordHash: hashPassword('admin123')
    }
  });

  const organizerUser = await prisma.user.create({
    data: {
      name: 'Nora Organisateur',
      email: 'orga@resacolo.com',
      passwordHash: hashPassword('orga123')
    }
  });

  const partnerUser = await prisma.user.create({
    data: {
      name: 'Paul Partenaire',
      email: 'partenaire@resacolo.com',
      passwordHash: hashPassword('partner123')
    }
  });

  await prisma.tenantUser.createMany({
    data: [
      { userId: adminUser.id, role: 'PLATFORM_ADMIN', tenantId: null },
      { userId: organizerUser.id, role: 'ORGANIZER_ADMIN', tenantId: organizerTenant.id },
      { userId: partnerUser.id, role: 'PARTNER_ADMIN', tenantId: partnerTenant.id }
    ]
  });

  await prisma.requestStage.createMany({
    data: [
      { key: 'NOUVELLE', label: 'Nouvelle', order: 1, scope: 'GLOBAL' },
      { key: 'QUALIFIEE', label: 'Qualifiee', order: 2, scope: 'GLOBAL' },
      { key: 'TRANSMISE', label: 'Transmise organisateur', order: 3, scope: 'GLOBAL' },
      { key: 'EN_COURS', label: 'En cours', order: 4, scope: 'GLOBAL' },
      { key: 'FINALISEE', label: 'Finalisee', order: 5, scope: 'GLOBAL', isTerminal: true },
      { key: 'PERDUE', label: 'Perdue', order: 6, scope: 'GLOBAL', isTerminal: true }
    ]
  });

  const stay = await prisma.stay.create({
    data: {
      organizerTenantId: organizerTenant.id,
      seasonId: season.id,
      title: 'Aventure en montagne',
      description: 'Un sejour sportif pour les ados.',
      ageMin: 12,
      ageMax: 16,
      location: 'Alpes',
      status: 'PUBLISHED'
    }
  });

  const sessionA = await prisma.staySession.create({
    data: {
      stayId: stay.id,
      seasonId: season.id,
      startDate: new Date('2026-07-05'),
      endDate: new Date('2026-07-19'),
      capacityTotal: 30,
      capacityReserved: 12
    }
  });

  const sessionB = await prisma.staySession.create({
    data: {
      stayId: stay.id,
      seasonId: season.id,
      startDate: new Date('2026-08-02'),
      endDate: new Date('2026-08-16'),
      capacityTotal: 25,
      capacityReserved: 18
    }
  });

  const assortment = await prisma.assortment.create({
    data: {
      partnerTenantId: partnerTenant.id,
      seasonId: season.id,
      name: 'Catalogue Ete 2026',
      status: 'ACTIVE'
    }
  });

  await prisma.assortmentItem.create({
    data: {
      assortmentId: assortment.id,
      type: 'STAY',
      targetRef: stay.id,
      include: true,
      priority: 1
    }
  });

  const firstStage = await prisma.requestStage.findFirst({ orderBy: { order: 'asc' } });
  if (firstStage) {
    const request = await prisma.request.create({
      data: {
        stayId: stay.id,
        sessionId: sessionA.id,
        seasonId: season.id,
        partnerTenantId: partnerTenant.id,
        currentStageId: firstStage.id
      }
    });

    await prisma.requestEvent.create({
      data: {
        requestId: request.id,
        seasonId: season.id,
        eventType: 'CREATED',
        newStageId: firstStage.id
      }
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
