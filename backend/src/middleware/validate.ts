import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

interface ValidationSchemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

/**
 * validate.ts
 * Parses req.body/query/params against the given Zod schemas and replaces
 * them with the parsed (validated + type-coerced) result, so controllers
 * receive clean, already-typed input and never call schema.parse()
 * themselves. Thrown ZodErrors are caught by express-async-errors and
 * formatted by middleware/errorHandler.ts into { success:false, errors }.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body)
    if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params
    next()
  }
}
