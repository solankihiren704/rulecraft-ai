import { createApp } from '@/app'
import { env } from '@/config/env'
import { logger } from '@/utils/logger'

/**
 * server.ts
 * Entry point. Creates the Express app (app.ts) and starts listening on
 * PORT from the environment. Kept separate from app.ts so tests can
 * import createApp() and use it with Supertest without binding a real
 * network port.
 */
const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`RuleCraft AI backend listening on http://localhost:${env.PORT}`)
})

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
