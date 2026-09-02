import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './users.controller'
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from './users.validators'

export const usersRouter = Router()
usersRouter.use(authenticate)

// Unlike most modules, this router gates GET too — the user directory is
// itself an access-control surface, not general academic data, so only
// staff who administer accounts get to browse it at all.
const view = authorize('super_admin', 'registrar')
const manage = authorize('super_admin')

usersRouter.get('/', view, validate({ query: listUsersQuerySchema }), controller.list)
usersRouter.get('/:id', view, validate({ params: idParamSchema }), controller.getById)
usersRouter.post('/', manage, validate({ body: createUserSchema }), controller.create)
usersRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateUserSchema }), controller.update)
usersRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
