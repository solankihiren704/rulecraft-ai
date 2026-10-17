import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './programs.controller'
import { createProgramSchema, listProgramsQuerySchema, updateProgramSchema } from './programs.validators'

export const programsRouter = Router()

const manage = [authenticate, authorize('super_admin', 'registrar')]

programsRouter.get('/', validate({ query: listProgramsQuerySchema }), controller.list)
programsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
programsRouter.post('/', ...manage, validate({ body: createProgramSchema }), controller.create)
programsRouter.patch('/:id', ...manage, validate({ params: idParamSchema, body: updateProgramSchema }), controller.update)
programsRouter.delete('/:id', ...manage, validate({ params: idParamSchema }), controller.remove)
