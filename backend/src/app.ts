import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env, isProduction } from '@/config/env'
import { healthRouter } from '@/routes/health.routes'
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler'
import { authRouter } from '@/modules/auth/auth.routes'
import { departmentsRouter } from '@/modules/departments/departments.routes'
import { programsRouter } from '@/modules/programs/programs.routes'
import { semestersRouter } from '@/modules/semesters/semesters.routes'
import { subjectsRouter } from '@/modules/subjects/subjects.routes'
import { academicStructureRouter } from '@/modules/academic-structure/academic-structure.routes'
import { regulationsRouter } from '@/modules/regulations/regulations.routes'
import { rulesRouter } from '@/modules/rules/rules.routes'
import { simulatorRouter } from '@/modules/simulator/simulator.routes'
import { studentsRouter } from '@/modules/students/students.routes'
import { usersRouter } from '@/modules/users/users.routes'
import { reportsRouter } from '@/modules/reports/reports.routes'
import { dashboardRouter } from '@/modules/dashboard/dashboard.routes'
import { publicVerifyRouter, resultsWorkflowRouter } from '@/modules/results/results.routes'
import { aiRouter } from '@/modules/ai/ai.routes'

/**
 * app.ts
 * Builds and configures the Express application: security headers (helmet),
 * CORS restricted to the configured frontend origin, request logging,
 * body parsing, rate limiting on the whole API, route mounting, and the
 * central error handler (must stay LAST). server.ts imports this and
 * calls app.listen(). Feature routers (auth, users, regulations, rules,
 * simulator, ai, reports, ...) are added here as later phases build them.
 */
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(morgan(isProduction ? 'combined' : 'dev'))

  const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api', apiLimiter)

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/departments', departmentsRouter)
  app.use('/api/programs', programsRouter)
  app.use('/api/semesters', semestersRouter)
  app.use('/api/subjects', subjectsRouter)
  app.use('/api/academic-structure', academicStructureRouter)
  app.use('/api/regulations', regulationsRouter)
  app.use('/api/rules', rulesRouter)
  app.use('/api/simulator', simulatorRouter)
  app.use('/api/students', studentsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/public', publicVerifyRouter)
  app.use('/api/results', resultsWorkflowRouter)
  app.use('/api/ai', aiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
