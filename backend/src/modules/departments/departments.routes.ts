import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './departments.controller'
import { createDepartmentSchema, updateDepartmentSchema } from './departments.validators'

export const departmentsRouter = Router()

const manage = [authenticate, authorize('super_admin', 'registrar')]

departmentsRouter.get('/', controller.list)
departmentsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
departmentsRouter.post('/', ...manage, validate({ body: createDepartmentSchema }), controller.create)
departmentsRouter.patch('/:id', ...manage, validate({ params: idParamSchema, body: updateDepartmentSchema }), controller.update)
departmentsRouter.delete('/:id', ...manage, validate({ params: idParamSchema }), controller.remove)
