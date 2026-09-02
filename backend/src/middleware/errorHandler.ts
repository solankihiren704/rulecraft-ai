import type { NextFunction, Request, Response } from 'express'
import { MulterError } from 'multer'
import { ZodError } from 'zod'
import { isProduction } from '@/config/env'
import { logger } from '@/utils/logger'

/**
 * errorHandler.ts
 * Central error-handling middleware (registered last in app.ts). Every
 * controller in this project throws or calls next(err) instead of
 * formatting its own error responses, so ALL API errors share one JSON
 * shape:
 *   { success: false, message: string, errors?: Record<string, string> }
 * This also guarantees we never leak stack traces or internal details
 * (DB connection strings, secrets, etc.) to the client in production.
 */
export class ApiError extends Error {
  statusCode: number
  errors?: Record<string, string>

  constructor(statusCode: number, message: string, errors?: Record<string, string>) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const errors: Record<string, string> = {}
    for (const issue of err.issues) {
      errors[issue.path.join('.') || 'value'] = issue.message
    }
    return res.status(400).json({ success: false, message: 'Validation failed', errors })
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large — the limit is 5MB.' : err.message
    return res.status(400).json({ success: false, message })
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    })
  }

  const message = err instanceof Error ? err.message : 'Unknown error'
  logger.error('Unhandled error', { message, stack: err instanceof Error ? err.stack : undefined })

  return res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : message,
  })
}
