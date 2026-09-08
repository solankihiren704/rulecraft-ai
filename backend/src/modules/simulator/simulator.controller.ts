import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { created, ok } from '@/utils/apiResponse'
import * as service from './simulator.service'

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  return req.user
}

export async function run(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.run(req.body, user)
  return created(res, data)
}

export async function history(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.history(req.query as never, user)
  return ok(res, data)
}

export async function batch(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.runBatch(req.body, user)
  return ok(res, data)
}
