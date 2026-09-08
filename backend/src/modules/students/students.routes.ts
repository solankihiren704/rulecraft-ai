import { Router } from 'express'
import multer from 'multer'
import { ApiError } from '@/middleware/errorHandler'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import { validate } from '@/middleware/validate'
import { idParamSchema } from '@/validators/common'
import * as controller from './students.controller'
import {
  createStudentSchema,
  exportStudentsSchema,
  importTemplateQuerySchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from './students.validators'

export const studentsRouter = Router()
studentsRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

// Memory storage — files are small class rosters (5MB cap below), parsed
// once via exceljs and discarded, never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isSpreadsheet =
      /\.(xlsx|csv)$/i.test(file.originalname) ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'text/csv'
    if (isSpreadsheet) cb(null, true)
    else cb(new ApiError(400, 'Only .xlsx or .csv files are supported.'))
  },
})

// Registered ahead of GET /:id so "/import/template" is never swallowed by
// the :id param route.
studentsRouter.get('/import/template', manage, validate({ query: importTemplateQuerySchema }), controller.importTemplate)
studentsRouter.post('/import', manage, upload.single('file'), controller.importStudents)

// Read-only, so open to any authenticated role — same visibility rules as
// GET / apply row-by-row (students.service.exportSelected).
studentsRouter.post('/export', validate({ body: exportStudentsSchema }), controller.exportSelected)

studentsRouter.get('/', validate({ query: listStudentsQuerySchema }), controller.list)
studentsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById)
studentsRouter.post('/', manage, validate({ body: createStudentSchema }), controller.create)
studentsRouter.patch('/:id', manage, validate({ params: idParamSchema, body: updateStudentSchema }), controller.update)
studentsRouter.delete('/:id', manage, validate({ params: idParamSchema }), controller.remove)
