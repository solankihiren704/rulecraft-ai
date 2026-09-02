import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { validate } from '@/middleware/validate'
import * as controller from './simulator.controller'
import { listHistoryQuerySchema, runSimulationSchema } from './simulator.validators'

export const simulatorRouter = Router()
simulatorRouter.use(authenticate)

// No authorize() gate beyond "authenticated" — every role may run
// simulations, scoped to their own data by simulator.service (students to
// themselves, HOD/Faculty to their department, staff to everything).
simulatorRouter.post('/run', validate({ body: runSimulationSchema }), controller.run)
simulatorRouter.get('/history', validate({ query: listHistoryQuerySchema }), controller.history)
