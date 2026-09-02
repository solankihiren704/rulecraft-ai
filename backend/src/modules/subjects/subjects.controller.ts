import type { Request, Response } from 'express'
import { created, noContent, ok } from '@/utils/apiResponse'
import * as service from './subjects.service'

export async function list(req: Request, res: Response) {
  const { semesterId, search } = req.query as { semesterId?: string; search?: string }
  const data = await service.list({ semesterId, search })
  return ok(res, data)
}

export async function getById(req: Request, res: Response) {
  const data = await service.getById(req.params.id as string)
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
