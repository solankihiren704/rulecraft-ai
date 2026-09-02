import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { created, noContent, ok } from '@/utils/apiResponse'
import * as service from './students.service'
import { parseImportRows } from './students.import'
import type { ImportTemplateQuery } from './students.validators'

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

export async function importTemplate(req: Request, res: Response) {
  const query = req.query as unknown as ImportTemplateQuery
  const buffer = await service.buildTemplate(query)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.xlsx"')
  return res.send(buffer)
}

export async function importStudents(req: Request, res: Response) {
  if (!req.file) throw new ApiError(400, 'Attach a .xlsx or .csv file to import.')
  const rows = await parseImportRows(req.file.buffer, req.file.originalname)
  const summary = await service.importStudents(rows)
  return ok(res, summary)
}
