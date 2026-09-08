import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import * as controller from './simulator.controller'
import { batchSimulationSchema, listHistoryQuerySchema, runSimulationSchema } from './simulator.validators'

export const simulatorRouter = Router()
simulatorRouter.use(authenticate)

// No authorize() gate beyond "authenticated" — every role may run
// simulations, scoped to their own data by simulator.service (students to
// themselves, HOD/Faculty to their department, staff to everything).
simulatorRouter.post('/run', validate({ body: runSimulationSchema }), controller.run)
simulatorRouter.get('/history', validate({ query: listHistoryQuerySchema }), controller.history)

// Batch is a staff bulk-operations tool (checking a whole cohort at once),
// not something a single student self-service checks, so it's gated
// tighter than /run — everyone but the student role, same as Reports.
simulatorRouter.post(
  '/batch',
  authorize('super_admin', 'registrar', 'hod', 'faculty'),
  validate({ body: batchSimulationSchema }),
  controller.batch,
)
