import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { created, noContent, ok } from '@/utils/apiResponse'
import * as service from './rules.service'

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  return req.user
}

export async function list(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.list(req.query as never, user.role)
  return ok(res, data)
}

export async function getById(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.getById(req.params.id as string, user.role)
  return ok(res, data)
}

export async function create(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.create(req.body, user.id)
  return created(res, data)
}

export async function update(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.update(req.params.id as string, req.body, user.id)
  return ok(res, data)
}

export async function remove(req: Request, res: Response) {
  const user = requireUser(req)
  await service.remove(req.params.id as string, user.id)
  return noContent(res)
}

export async function toggleActive(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.toggleActive(req.params.id as string, user.id)
  return ok(res, data)
}
