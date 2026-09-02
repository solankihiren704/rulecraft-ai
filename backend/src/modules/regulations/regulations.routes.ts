import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './regulations.controller'
import {
  createRegulationSchema,
  listRegulationsQuerySchema,
  rejectRegulationSchema,
  reviewRegulationSchema,
  updateRegulationSchema,
} from './regulations.validators'

export const regulationsRouter = Router()
regulationsRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

regulationsRouter.get('/', validate({ query: listRegulationsQuerySchema }), controller.list)
regulationsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
regulationsRouter.post('/', manage, validate({ body: createRegulationSchema }), controller.create)
regulationsRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateRegulationSchema }), controller.update)
regulationsRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)

regulationsRouter.post('/:id/submit', manage, validate({ params: idParamSchema }), controller.submit)
regulationsRouter.post(
  '/:id/review',
  authorize('super_admin', 'hod'),
  validate({ params: idParamSchema, body: reviewRegulationSchema }),
  controller.review,
)
regulationsRouter.post('/:id/approve', authorize('super_admin'), validate({ params: idParamSchema }), controller.approve)
regulationsRouter.post(
  '/:id/reject',
  authorize('super_admin', 'hod'),
  validate({ params: idParamSchema, body: rejectRegulationSchema }),
  controller.reject,
)
regulationsRouter.post('/:id/archive', manage, validate({ params: idParamSchema }), controller.archive)
regulationsRouter.post('/:id/duplicate', manage, validate({ params: idParamSchema }), controller.duplicate)
