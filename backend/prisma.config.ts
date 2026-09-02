import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 config: the schema file no longer carries a datasource `url`
// (that produces a validation error now — see src/config/prisma.ts for the
// runtime client, which needs its own driver adapter). This file is only
// consulted by the Prisma CLI (migrate, studio, db seed), not by the app.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
