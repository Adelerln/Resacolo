import { PrismaClient } from '@prisma/client';

type PrismaClientType = PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

function createUnavailableClient(cause: unknown): PrismaClientType {
  const message =
    cause instanceof Error
      ? cause.message
      : 'Prisma client is unavailable. Run "npx prisma generate" after fixing prisma/schema.prisma.';
  return new Proxy({} as PrismaClientType, {
    get() {
      throw new Error(message);
    }
  });
}

function createClient() {
  if (process.env.MOCK_UI === '1') {
    return createUnavailableClient('Prisma disabled in MOCK_UI mode.');
  }
  return new PrismaClient({
    log: ['warn', 'error']
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
