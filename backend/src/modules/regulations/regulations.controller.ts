import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { created, noContent, ok } from '@/utils/apiResponse'
import * as service from './regulations.service'

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
  const data = await service.update(req.params.id as string, req.body)
  return ok(res, data)
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id as string)
  return noContent(res)
}

export async function submit(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.submit(req.params.id as string, user.id)
  return ok(res, data)
}

export async function review(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.review(req.params.id as string, user.id, req.body?.note)
  return ok(res, data)
}

export async function approve(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.approve(req.params.id as string, user.id)
  return ok(res, data)
}

export async function reject(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.reject(req.params.id as string, user.id, req.body.note)
  return ok(res, data)
}

export async function archive(req: Request, res: Response) {
  const data = await service.archive(req.params.id as string)
  return ok(res, data)
}

export async function duplicate(req: Request, res: Response) {
  const user = requireUser(req)
  const data = await service.duplicate(req.params.id as string, user.id)
  return created(res, data)
}
