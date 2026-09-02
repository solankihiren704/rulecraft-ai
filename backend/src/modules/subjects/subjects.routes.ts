import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './subjects.controller'
import { createSubjectSchema, listSubjectsQuerySchema, updateSubjectSchema } from './subjects.validators'

export const subjectsRouter = Router()
subjectsRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

subjectsRouter.get('/', validate({ query: listSubjectsQuerySchema }), controller.list)
subjectsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
subjectsRouter.post('/', manage, validate({ body: createSubjectSchema }), controller.create)
subjectsRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateSubjectSchema }), controller.update)
subjectsRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
