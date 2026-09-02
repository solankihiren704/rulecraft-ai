import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './students.controller'
import { createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from './students.validators'

export const studentsRouter = Router()
studentsRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

studentsRouter.get('/', validate({ query: listStudentsQuerySchema }), controller.list)
studentsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
studentsRouter.post('/', manage, validate({ body: createStudentSchema }), controller.create)
studentsRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateStudentSchema }), controller.update)
studentsRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
