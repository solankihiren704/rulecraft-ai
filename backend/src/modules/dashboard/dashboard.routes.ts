import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import * as controller from './dashboard.controller'

export const dashboardRouter = Router()
dashboardRouter.use(authenticate)

// No authorize() gate beyond "authenticated" — every role gets a valid
// response, scoped by dashboard.service.ts using each source module's own
// established visibility rules (same shape as simulator.routes.ts).
dashboardRouter.get('/summary', controller.summary)
