import { PrismaClient } from '@prisma/client';

// Single shared Prisma client instance for the entire backend.
// Prevents the N×connection-pool problem that occurs when each module
// instantiates its own PrismaClient.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
