import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './semesters.controller'
import { createSemesterSchema, listSemestersQuerySchema, updateSemesterSchema } from './semesters.validators'

export const semestersRouter = Router()
semestersRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

semestersRouter.get('/', validate({ query: listSemestersQuerySchema }), controller.list)
semestersRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
semestersRouter.post('/', manage, validate({ body: createSemesterSchema }), controller.create)
semestersRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateSemesterSchema }), controller.update)
semestersRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
