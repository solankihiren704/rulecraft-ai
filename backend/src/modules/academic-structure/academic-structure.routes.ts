import { Router } from 'express'
import multer from 'multer'
import { ApiError } from '@/middleware/errorHandler'
import { authenticate } from '@/middleware/authenticate'
import { authorize } from '@/middleware/authorize'
import * as controller from './academic-structure.controller'

export const academicStructureRouter = Router()
academicStructureRouter.use(authenticate)

const manage = authorize('super_admin', 'registrar')

// Memory storage — same reasoning as the student import: files are small,
// parsed once via exceljs, never written to disk.
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

academicStructureRouter.get('/import/template', manage, controller.importTemplate)
academicStructureRouter.post('/import', manage, upload.single('file'), controller.importHierarchy)
