import type { Request, Response } from 'express'
import { ApiError } from '@/middleware/errorHandler'
import { ok } from '@/utils/apiResponse'
import * as service from './academic-structure.service'
import { buildImportTemplate, parseImportRows } from './academic-structure.import'

export async function importTemplate(_req: Request, res: Response) {
  const buffer = await buildImportTemplate()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="academic-structure-import-template.xlsx"')
  return res.send(buffer)
}

export async function importHierarchy(req: Request, res: Response) {
  if (!req.file) throw new ApiError(400, 'Attach a .xlsx or .csv file to import.')
  const rows = await parseImportRows(req.file.buffer, req.file.originalname)
  const summary = await service.importHierarchy(rows)
  return ok(res, summary)
}
