import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '@/config/env'

/**
 * prisma.ts
 * Single shared Prisma Client instance (singleton) for the whole backend.
 * Repositories/services import `prisma` from here rather than each
 * creating their own client, which would exhaust DB connections.
 *
 * Prisma 7 requires an explicit driver adapter at runtime (the schema file
 * no longer carries a connection URL — see prisma/schema.prisma and
 * prisma.config.ts, which handles the CLI side of this same split).
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})
