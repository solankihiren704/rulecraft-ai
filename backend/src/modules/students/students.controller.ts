import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { created, noContent, ok } from '@/utils/apiResponse'
import * as service from './students.service'

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  return req.user
}

export async function list(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.list(req.query as never, user)
  return ok(res, data)
}

export async function getById(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.getById(req.params.id as string, user)
  return ok(res, data)
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.body)
  return created(res, data)
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id as string, req.body)
  return ok(res, data)
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id as string)
  return noContent(res)
}
