import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { ok } from '@/utils/apiResponse'
import * as service from './dashboard.service'

export async function summary(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const data = await service.getSummary(req.user)
  return ok(res, data)
}
