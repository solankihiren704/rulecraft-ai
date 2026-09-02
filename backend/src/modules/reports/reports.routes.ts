import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './reports.controller'
import { generateReportSchema } from './reports.validators'

export const reportsRouter = Router()
reportsRouter.use(authenticate)

// Report generation touches student eligibility outcomes across a whole
// regulation, so it's gated the same as Regulations/Rules' full-visibility
// staff set (super_admin/registrar/hod) rather than every authenticated
// role — enforced again in the service (assertInScope for hod) since a
// department-department check needs the regulation loaded first.
const view = authorize('super_admin', 'registrar', 'hod')

reportsRouter.get('/', view, controller.list)
reportsRouter.post('/generate', view, validate({ body: generateReportSchema }), controller.generate)
reportsRouter.get('/:id/download', view, validate({ params: idParamSchema }), controller.download)
reportsRouter.delete('/:id', view, validate({ params: idParamSchema }), controller.remove)
