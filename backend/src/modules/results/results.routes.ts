import { Router, type Request, type Response } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { ApiError } from '@/middleware/errorHandler'
import * as studentsRepo from '@/modules/students/students.repository'
import {
  computeStudentResult,
  renderMarksheetPdf,
  validateVerificationToken,
} from '@/modules/students/students.result'
import {
  getWorkflowStatus,
  transitionWorkflow,
} from './results.workflow'

export const resultsWorkflowRouter = Router()
export const publicVerifyRouter = Router()

/**
 * Public Verification Endpoints (No login required)
 * Allows employers, academic evaluators, or students to verify
 * the authenticity of any issued marksheet by scanning the QR code.
 */
publicVerifyRouter.get('/verify/:token', async (req: Request, res: Response) => {
  const token = String(req.params.token)
  const studentId = validateVerificationToken(token)

  if (!studentId) {
    throw new ApiError(404, 'Invalid, altered, or unverified academic credential token.')
  }

  const student = await studentsRepo.findResultStudentById(studentId)
  if (!student) {
    throw new ApiError(404, 'No matching student record found for this verification token.')
  }

  const result = await computeStudentResult(student)

  res.json({
    success: true,
    data: {
      verified: true,
      verifiedAt: new Date().toISOString(),
      institution: 'Northbridge University',
      issuingOffice: 'Office of the Controller of Examinations',
      token,
      certificateNo: result.verification.certificateNo,
      student: result.student,
      academicSummary: result.academicSummary,
      subjects: result.subjects,
      regulationVerdict: result.regulationVerdict,
      publicationStatus: result.publicationStatus,
      qrCodeDataUrl: result.verification.qrCodeDataUrl,
    },
  })
})

publicVerifyRouter.get('/verify/:token/pdf', async (req: Request, res: Response) => {
  const token = String(req.params.token)
  const studentId = validateVerificationToken(token)

  if (!studentId) {
    throw new ApiError(404, 'Invalid or altered academic credential token.')
  }

  const student = await studentsRepo.findResultStudentById(studentId)
  if (!student) {
    throw new ApiError(404, 'Student record not found.')
  }

  const result = await computeStudentResult(student)
  const buffer = await renderMarksheetPdf(result)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="verified-marksheet-${result.student.studentId}.pdf"`,
  )
  res.send(buffer)
})

/**
 * Result Workflow Management (Authenticated)
 * Allows faculty to submit marks, HOD to approve, and Registrar to publish.
 */
resultsWorkflowRouter.use(authenticate)

resultsWorkflowRouter.get('/workflow/status', async (req: Request, res: Response) => {
  const programId = (req.query.programId as string) || 'all'
  const record = getWorkflowStatus(programId)
  res.json({ success: true, data: record })
})

resultsWorkflowRouter.post('/workflow/transition', async (req: Request, res: Response) => {
  const { programId = 'all', action, notes } = req.body

  if (!action || !['submit', 'approve', 'publish', 'revert'].includes(action)) {
    throw new ApiError(400, 'Invalid workflow action. Allowed: submit, approve, publish, revert')
  }

  const record = transitionWorkflow({
    programId,
    action,
    notes,
    user: req.user!,
  })

  res.json({
    success: true,
    message: `Result publishing workflow successfully updated to ${record.status.toUpperCase()}.`,
    data: record,
  })
})

/**
 * Faculty Gradebook Matrix Endpoints
 */
resultsWorkflowRouter.get('/gradebook', async (req: Request, res: Response) => {
  if (req.user?.role === 'student') {
    throw new ApiError(403, 'Students are not authorized to view the faculty gradebook.')
  }

  const { getGradebookMatrix } = await import('./gradebook.store')
  const data = await getGradebookMatrix(
    {
      programId: req.query.programId as string | undefined,
      semesterId: req.query.semesterId as string | undefined,
      subjectCode: req.query.subjectCode as string | undefined,
    },
    req.user!
  )

  res.json({ success: true, data })
})

resultsWorkflowRouter.post('/gradebook/save', async (req: Request, res: Response) => {
  if (req.user?.role === 'student') {
    throw new ApiError(403, 'Students are not authorized to modify marks in the gradebook.')
  }

  const { saveGradebookEntries } = await import('./gradebook.store')
  const { programId, semesterId, subjectCode, subjectName, entries, submitForModeration } = req.body

  const saveResult = await saveGradebookEntries(
    {
      programId,
      semesterId,
      subjectCode,
      subjectName,
      entries,
      submitForModeration,
    },
    req.user!
  )

  let workflowRecord = null
  if (submitForModeration) {
    workflowRecord = transitionWorkflow({
      programId: programId || 'all',
      action: 'submit',
      notes: `Marks batch submitted for moderation by ${req.user?.role?.toUpperCase()} (${subjectCode}).`,
      user: req.user!,
    })
  }

  res.json({
    success: true,
    message: submitForModeration
      ? `Marks saved and submitted for HOD moderation (${entries.length} students).`
      : `Marks draft successfully saved for ${entries.length} students.`,
    data: {
      ...saveResult,
      workflow: workflowRecord,
    },
  })
})

/**
 * University Rank List, Toppers & Dean's Honor Roll Endpoints
 */
resultsWorkflowRouter.get('/ranks', async (req: Request, res: Response) => {
  const { getUniversityRanks } = await import('./results.ranks.service')
  const yearParam = req.query.year ? parseInt(String(req.query.year), 10) : undefined

  const data = await getUniversityRanks({
    programId: req.query.programId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
    year: Number.isNaN(yearParam) ? undefined : yearParam,
    search: req.query.search as string | undefined,
    filterType: (req.query.filterType as 'all' | 'deans_list' | 'probation') || 'all',
  })

  res.json({ success: true, data })
})

resultsWorkflowRouter.get('/ranks/export', async (req: Request, res: Response) => {
  const { exportRanksCsv } = await import('./results.ranks.service')
  const yearParam = req.query.year ? parseInt(String(req.query.year), 10) : undefined

  const csv = await exportRanksCsv({
    programId: req.query.programId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
    year: Number.isNaN(yearParam) ? undefined : yearParam,
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="university-rank-list.csv"')
  res.send(csv)
})

