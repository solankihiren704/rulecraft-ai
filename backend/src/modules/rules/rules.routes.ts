import { Router } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './rules.controller'
import { createRuleSchema, listRulesQuerySchema, updateRuleSchema } from './rules.validators'

export const rulesRouter = Router()
rulesRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

rulesRouter.get('/', validate({ query: listRulesQuerySchema }), controller.list)
rulesRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
rulesRouter.post('/', manage, validate({ body: createRuleSchema }), controller.create)
rulesRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateRuleSchema }), controller.update)
rulesRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
rulesRouter.patch('/:id/toggle', manage, validate({ params: idParamSchema }), controller.toggleActive)
