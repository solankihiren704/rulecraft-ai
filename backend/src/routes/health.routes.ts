import { Router } from 'express'

/**
 * health.routes.ts
 * Simple liveness endpoint used to verify the API is running (and, once
 * the database is wired up in Phase 2, that it can reach PostgreSQL).
 * Mounted at GET /api/health in app.ts.
 */
export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'RuleCraft AI API is running',
    timestamp: new Date().toISOString(),
  })
})
