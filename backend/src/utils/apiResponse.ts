import type { Response } from 'express'

/**
 * apiResponse.ts
 * Every controller shapes its success response through these two helpers so
 * the envelope defined in types/index.ts (ApiSuccess/ApiPaginated) is never
 * hand-rolled differently in two places. Error responses are handled
 * entirely by middleware/errorHandler.ts via thrown ApiError.
 */
export function ok<T>(res: Response, data: T, message?: string, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, ...(message ? { message } : {}) })
}

export function created<T>(res: Response, data: T, message?: string) {
  return ok(res, data, message, 201)
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number },
) {
  return res.status(200).json({ success: true, data, meta })
}

export function noContent(res: Response) {
  return res.status(204).send()
}
