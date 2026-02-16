type PrismaClientType = {
  $disconnect: () => Promise<void>;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

function createClient() {
  if (process.env.MOCK_UI === '1') {
    throw new Error('Prisma disabled in MOCK_UI mode.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (...args: any[]) => PrismaClientType };
  return new PrismaClient({
    log: ['warn', 'error']
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
