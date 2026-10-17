import crypto from 'node:crypto'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { evaluateRegulation } from '@/rule-engine/evaluate'
import type { ConditionNode } from '@/types'
import { getWorkflowStatus, type ResultWorkflowStatus } from '@/modules/results/results.workflow'
import { getAllStoredMarksForStudent } from '@/modules/results/gradebook.store'

export interface SubjectResult {
  code: string
  name: string
  credits: number
  maxMarks: number
  marksObtained: number
  grade: string
  gradePoints: number
  status: 'passed' | 'passed_with_grace' | 'failed'
  graceMarksApplied?: number
}

export interface VerificationData {
  token: string
  verificationUrl: string
  qrCodeDataUrl: string
  issuedAt: string
  issuer: string
  certificateNo: string
}

export interface StudentResultData {
  student: {
    id: string
    name: string
    studentId: string
    email: string
    programName: string
    programCode: string
    departmentName: string
    year: number
    semesterName: string
    status: string
    enrollDate: string
    attendance?: number
  }
  academicSummary: {
    totalMarksObtained: number
    maxTotalMarks: number
    percentage: number
    sgpa: number
    cgpa: number
    totalCredits: number
    creditsEarned: number
  }
  subjects: SubjectResult[]
  regulationVerdict: {
    regulationName: string
    regulationCode: string
    outcome: 'promoted' | 'promoted_with_atkt' | 'distinction' | 'detained'
    outcomeLabel: string
    ruleEvaluations: {
      ruleName: string
      ruleType: string
      passed: boolean
      detail: string
    }[]
  }
  verification: VerificationData
  publicationStatus: ResultWorkflowStatus
  generatedAt: string
}

const VERIFY_SECRET = process.env.JWT_SECRET || 'rulecraft-verification-secret-2026'

export function generateVerificationToken(studentId: string): string {
  const sig = crypto.createHmac('sha256', VERIFY_SECRET).update(studentId).digest('hex').slice(0, 16)
  return Buffer.from(`${studentId}::${sig}`).toString('base64url')
}

export function validateVerificationToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const [studentId, sig] = raw.split('::')
    if (!studentId || !sig) return null
    const expected = crypto.createHmac('sha256', VERIFY_SECRET).update(studentId).digest('hex').slice(0, 16)
    if (sig === expected) return studentId
    return null
  } catch {
    return null
  }
}

const DEFAULT_CURRICULUM: Record<string, { code: string; name: string; credits: number }[]> = {
  CSE: [
    { code: 'CS101', name: 'Programming Fundamentals', credits: 4 },
    { code: 'CS102', name: 'Data Structures & Algorithms', credits: 4 },
    { code: 'CS201', name: 'Database Management Systems', credits: 4 },
    { code: 'CS202', name: 'Computer Networks', credits: 3 },
    { code: 'CS203', name: 'Operating Systems', credits: 4 },
  ],
  ECE: [
    { code: 'EC101', name: 'Digital Electronics', credits: 4 },
    { code: 'EC102', name: 'Signals & Systems', credits: 4 },
    { code: 'EC201', name: 'Microprocessors & Microcontrollers', credits: 4 },
    { code: 'EC202', name: 'Analog Integrated Circuits', credits: 3 },
  ],
  ME: [
    { code: 'ME101', name: 'Thermodynamics', credits: 4 },
    { code: 'ME102', name: 'Fluid Mechanics', credits: 4 },
    { code: 'ME201', name: 'Kinematics of Machinery', credits: 3 },
    { code: 'ME202', name: 'Manufacturing Processes', credits: 4 },
  ],
  CE: [
    { code: 'CE101', name: 'Structural Analysis', credits: 4 },
    { code: 'CE102', name: 'Surveying & Geomatics', credits: 3 },
    { code: 'CE201', name: 'Building Materials & Construction', credits: 4 },
    { code: 'CE202', name: 'Soil Mechanics', credits: 4 },
  ],
}

function calculateGrade(marks: number): { grade: string; gradePoints: number } {
  if (marks >= 90) return { grade: 'O', gradePoints: 10 }
  if (marks >= 80) return { grade: 'A+', gradePoints: 9 }
  if (marks >= 70) return { grade: 'A', gradePoints: 8 }
  if (marks >= 60) return { grade: 'B+', gradePoints: 7 }
  if (marks >= 50) return { grade: 'B', gradePoints: 6 }
  if (marks >= 40) return { grade: 'C', gradePoints: 5 }
  return { grade: 'F', gradePoints: 0 }
}

export async function computeStudentResult(student: {
  id: string
  name: string
  studentId: string
  email: string
  year: number
  status: string
  gpa: number
  attendance?: number | null
  enrollDate: Date | string
  program: {
    id: string
    name: string
    code: string
    department: { name: string; code: string }
    semesters: {
      name: string
      year: number
      subjects: { code: string; name: string; credits: number }[]
    }[]
    regulations: {
      id: string
      name: string
      code: string
      rules: { name: string; type: string; outcome: string; active: boolean; conditionTree: unknown }[]
    }[]
  }
}): Promise<StudentResultData> {
  const deptCode = student.program.department.code.toUpperCase()
  const semesterNum = Math.min(8, Math.max(1, student.year * 2))
  const semesterName = `Semester ${semesterNum}`

  // Pick curriculum subjects from DB or fallback
  const dbSubjects = student.program.semesters
    .flatMap((s) => s.subjects)
    .filter((s, idx, arr) => arr.findIndex((x) => x.code === s.code) === idx)

  const rawSubjects =
    dbSubjects.length >= 3
      ? dbSubjects
      : (DEFAULT_CURRICULUM[deptCode] ?? DEFAULT_CURRICULUM.CSE)

  // Calculate base score from student GPA (scale of 4 or 10)
  const gpaNorm = student.gpa <= 4.0 ? (student.gpa / 4.0) * 10.0 : student.gpa
  const baseMarks = Math.round((gpaNorm / 10.0) * 88)

  const storedMarks = getAllStoredMarksForStudent(student.id, student.studentId)

  const subjects: SubjectResult[] = rawSubjects.map((sub, i) => {
    const saved = storedMarks[sub.code.toUpperCase()]
    if (saved) {
      return {
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        maxMarks: 100,
        marksObtained: saved.totalMarks,
        grade: saved.grade,
        gradePoints: saved.gradePoints,
        status: saved.status,
        graceMarksApplied: saved.graceMarksApplied,
      }
    }

    // Generate deterministic variance per subject using student ID char code
    const variance = ((student.studentId.charCodeAt(student.studentId.length - 1) + i * 7) % 17) - 8
    let marks = Math.min(98, Math.max(34, baseMarks + variance))

    // Handle Grace Marks shortfall scenario if student is suspended or borderline
    let graceMarksApplied = 0
    let status: 'passed' | 'passed_with_grace' | 'failed' = 'passed'

    if (marks >= 35 && marks < 40) {
      graceMarksApplied = 40 - marks
      marks = 40
      status = 'passed_with_grace'
    } else if (marks < 40) {
      status = 'failed'
    }

    const { grade, gradePoints } = calculateGrade(marks)

    return {
      code: sub.code,
      name: sub.name,
      credits: sub.credits,
      maxMarks: 100,
      marksObtained: marks,
      grade,
      gradePoints,
      status,
      graceMarksApplied: graceMarksApplied > 0 ? graceMarksApplied : undefined,
    }
  })

  const totalMarksObtained = subjects.reduce((sum, s) => sum + s.marksObtained, 0)
  const maxTotalMarks = subjects.length * 100
  const percentage = Math.round((totalMarksObtained / maxTotalMarks) * 1000) / 10

  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0)
  const creditsEarned = subjects.filter((s) => s.status !== 'failed').reduce((sum, s) => sum + s.credits, 0)

  const weightedPoints = subjects.reduce((sum, s) => sum + s.credits * s.gradePoints, 0)
  const sgpa = totalCredits > 0 ? Math.round((weightedPoints / totalCredits) * 100) / 100 : 0
  const cgpa = Math.round(gpaNorm * 100) / 100

  // Evaluate against active regulations
  const activeReg = student.program.regulations[0] ?? {
    name: 'Academic Regulations & Promotion Policy',
    code: 'REG-2024-STANDARD',
    rules: [],
  }

  const failedCount = subjects.filter((s) => s.status === 'failed').length
  const attendanceVal = student.attendance != null ? Math.round(student.attendance) : (student.status === 'suspended' ? 64 : 88)
  const attendance = String(attendanceVal)

  const engineRules = activeReg.rules.map((r) => ({
    name: r.name,
    outcome: r.outcome,
    conditionTree: r.conditionTree as ConditionNode,
  }))

  const evaluationFacts = {
    cgpa: String(cgpa),
    gpa: String(student.gpa),
    subjectMarks: String(Math.round(percentage)),
    marks: String(Math.round(percentage)),
    attendancePercent: attendance,
    activeBacklogs: String(failedCount),
    credits: String(creditsEarned),
  }

  const evalResult = evaluateRegulation(engineRules, evaluationFacts)

  let outcome: 'promoted' | 'promoted_with_atkt' | 'distinction' | 'detained' = 'promoted'
  let outcomeLabel = 'PROMOTED TO NEXT ACADEMIC YEAR'

  if (student.status === 'suspended' || failedCount > 2) {
    outcome = 'detained'
    outcomeLabel = 'DETAINED / ACADEMIC PROBATION'
  } else if (attendanceVal < 65) {
    outcome = 'detained'
    outcomeLabel = `DETAINED DUE TO ATTENDANCE SHORTAGE (${attendanceVal}% < 65%)`
  } else if (failedCount > 0) {
    outcome = 'promoted_with_atkt'
    outcomeLabel = 'PROMOTED WITH ATKT (ACTIVE BACKLOG)'
  } else if (cgpa >= 8.5) {
    outcome = 'distinction'
    outcomeLabel = 'PASSED WITH FIRST CLASS WITH DISTINCTION'
  }

  const enrollDateStr =
    student.enrollDate instanceof Date
      ? student.enrollDate.toISOString().slice(0, 10)
      : String(student.enrollDate).slice(0, 10)

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const verificationToken = generateVerificationToken(student.id)
  const verificationUrl = `${baseUrl}/verify/${verificationToken}`
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 140, margin: 1 })
  const certYear = student.enrollDate instanceof Date ? student.enrollDate.getFullYear() : 2024
  const certificateNo = `NU-MRK-${student.studentId}-${certYear}`
  const workflowRecord = getWorkflowStatus(student.program.id || 'all')

  return {
    student: {
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      programName: student.program.name,
      programCode: student.program.code,
      departmentName: student.program.department.name,
      year: student.year,
      semesterName,
      status: student.status,
      enrollDate: enrollDateStr,
      attendance: attendanceVal,
    },
    academicSummary: {
      totalMarksObtained,
      maxTotalMarks,
      percentage,
      sgpa,
      cgpa,
      totalCredits,
      creditsEarned,
    },
    subjects,
    regulationVerdict: {
      regulationName: activeReg.name,
      regulationCode: activeReg.code,
      outcome,
      outcomeLabel,
      ruleEvaluations: evalResult.breakdown.map((b) => ({
        ruleName: b.rule,
        ruleType: activeReg.rules.find((r) => r.name === b.rule)?.type ?? 'general',
        passed: b.passed,
        detail: b.detail,
      })),
    },
    verification: {
      token: verificationToken,
      verificationUrl,
      qrCodeDataUrl,
      issuedAt: new Date().toISOString(),
      issuer: 'Office of Controller of Examinations, Northbridge University',
      certificateNo,
    },
    publicationStatus: workflowRecord.status,
    generatedAt: new Date().toISOString(),
  }
}

export async function renderMarksheetPdf(data: StudentResultData): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(data.verification.verificationUrl, { width: 64, margin: 1 })
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // University Header
    doc.fontSize(19).font('Helvetica-Bold').fillColor('#0f172a').text('NORTHBRIDGE UNIVERSITY', { align: 'center' })
    doc.fontSize(10).font('Helvetica').fillColor('#475569').text('ACADEMIC EVALUATION & EXAMINATION CONTROLLER', { align: 'center' })
    doc.moveDown(0.2)
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#4338ca').text('OFFICIAL SEMESTER GRADE REPORT & MARKSHEET', { align: 'center' })
    doc.moveDown(0.5)

    // Horizontal Rule
    const leftMargin = 36
    const rightMargin = doc.page.width - 36
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke()
    doc.moveDown(0.6)

    // Student Information Grid
    const infoY = doc.y
    const col2X = leftMargin + 260

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Student Name:', leftMargin, infoY)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(data.student.name, leftMargin + 80, infoY)

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Student ID:', col2X, infoY)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(data.student.studentId, col2X + 70, infoY)

    doc.moveDown(0.4)
    const line2Y = doc.y

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Program:', leftMargin, line2Y)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(`${data.student.programName} (${data.student.programCode})`, leftMargin + 80, line2Y)

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Semester / Year:', col2X, line2Y)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(`${data.student.semesterName} (Year ${data.student.year})`, col2X + 80, line2Y)

    doc.moveDown(0.4)
    const line3Y = doc.y

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Department:', leftMargin, line3Y)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(data.student.departmentName, leftMargin + 80, line3Y)

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Academic Status:', col2X, line3Y)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(data.student.status === 'active' ? '#16a34a' : '#dc2626').text(data.student.status.toUpperCase(), col2X + 80, line3Y)

    doc.moveDown(0.8)
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke()
    doc.moveDown(0.6)

    // Table Header
    const cols = [
      { title: 'Code', x: leftMargin, w: 55 },
      { title: 'Subject Title', x: leftMargin + 60, w: 200 },
      { title: 'Credits', x: leftMargin + 265, w: 45 },
      { title: 'Max', x: leftMargin + 315, w: 35 },
      { title: 'Marks', x: leftMargin + 355, w: 40 },
      { title: 'Grade', x: leftMargin + 400, w: 40 },
      { title: 'Points', x: leftMargin + 445, w: 35 },
      { title: 'Status', x: leftMargin + 485, w: 45 },
    ]

    const tableHeaderY = doc.y
    doc.rect(leftMargin, tableHeaderY - 2, rightMargin - leftMargin, 16).fill('#f1f5f9')
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
    cols.forEach((c) => doc.text(c.title, c.x, tableHeaderY + 2, { width: c.w }))

    doc.moveDown(0.4)
    let curY = tableHeaderY + 18

    // Table Rows
    data.subjects.forEach((sub, idx) => {
      const isAlt = idx % 2 === 1
      if (isAlt) {
        doc.rect(leftMargin, curY - 2, rightMargin - leftMargin, 16).fill('#f8fafc')
      }

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(sub.code, cols[0].x, curY, { width: cols[0].w })
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b').text(sub.name, cols[1].x, curY, { width: cols[1].w, ellipsis: true })
      doc.text(String(sub.credits), cols[2].x, curY, { width: cols[2].w })
      doc.text(String(sub.maxMarks), cols[3].x, curY, { width: cols[3].w })

      const markStr = sub.graceMarksApplied ? `${sub.marksObtained}*` : String(sub.marksObtained)
      doc.font('Helvetica-Bold').text(markStr, cols[4].x, curY, { width: cols[4].w })
      doc.fillColor('#4338ca').text(sub.grade, cols[5].x, curY, { width: cols[5].w })
      doc.fillColor('#0f172a').text(String(sub.gradePoints), cols[6].x, curY, { width: cols[6].w })

      const statusColor = sub.status === 'failed' ? '#dc2626' : sub.status === 'passed_with_grace' ? '#d97706' : '#16a34a'
      const statusLabel = sub.status === 'passed_with_grace' ? 'Pass*' : sub.status === 'failed' ? 'Fail' : 'Pass'
      doc.font('Helvetica-Bold').fillColor(statusColor).text(statusLabel, cols[7].x, curY, { width: cols[7].w })

      curY += 16
    })

    doc.y = curY
    doc.moveDown(0.6)
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke()
    doc.moveDown(0.6)

    // Summary Box
    const sumBoxY = doc.y
    doc.rect(leftMargin, sumBoxY, rightMargin - leftMargin, 42).fill('#f8fafc')
    doc.rect(leftMargin, sumBoxY, rightMargin - leftMargin, 42).strokeColor('#e2e8f0').lineWidth(0.5).stroke()

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
    doc.text('TOTAL MARKS', leftMargin + 15, sumBoxY + 8)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
    doc.text(`${data.academicSummary.totalMarksObtained} / ${data.academicSummary.maxTotalMarks}`, leftMargin + 15, sumBoxY + 20)

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
    doc.text('PERCENTAGE', leftMargin + 120, sumBoxY + 8)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
    doc.text(`${data.academicSummary.percentage}%`, leftMargin + 120, sumBoxY + 20)

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
    doc.text('SEMESTER SGPA', leftMargin + 220, sumBoxY + 8)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#4338ca')
    doc.text(data.academicSummary.sgpa.toFixed(2), leftMargin + 220, sumBoxY + 20)

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
    doc.text('CUMULATIVE CGPA', leftMargin + 325, sumBoxY + 8)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#4338ca')
    doc.text(data.academicSummary.cgpa.toFixed(2), leftMargin + 325, sumBoxY + 20)

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
    doc.text('CREDITS EARNED', leftMargin + 435, sumBoxY + 8)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#16a34a')
    doc.text(`${data.academicSummary.creditsEarned} / ${data.academicSummary.totalCredits}`, leftMargin + 435, sumBoxY + 20)

    doc.y = sumBoxY + 50
    doc.moveDown(0.5)

    // RuleCraft Engine Regulation Decision Box
    const decisionY = doc.y
    const isPass = data.regulationVerdict.outcome !== 'detained'
    const boxBg = isPass ? '#f0fdf4' : '#fef2f2'
    const boxBorder = isPass ? '#bbf7d0' : '#fecaca'

    doc.rect(leftMargin, decisionY, rightMargin - leftMargin, 55).fill(boxBg)
    doc.rect(leftMargin, decisionY, rightMargin - leftMargin, 55).strokeColor(boxBorder).lineWidth(1).stroke()

    doc.font('Helvetica-Bold').fontSize(8).fillColor(isPass ? '#166534' : '#991b1b')
    doc.text(`RULECRAFT AI ACADEMIC REGULATION DECISION (${data.regulationVerdict.regulationCode})`, leftMargin + 12, decisionY + 8)

    doc.font('Helvetica-Bold').fontSize(11).fillColor(isPass ? '#15803d' : '#b91c1c')
    doc.text(data.regulationVerdict.outcomeLabel, leftMargin + 12, decisionY + 20)

    doc.font('Helvetica').fontSize(8).fillColor('#475569')
    const ruleSummary = data.regulationVerdict.ruleEvaluations
      .map((r) => `${r.ruleName}: ${r.passed ? 'Satisfied' : 'Not Satisfied'}`)
      .join('  |  ')
    doc.text(`Policy: ${data.regulationVerdict.regulationName}  •  ${ruleSummary}`, leftMargin + 12, decisionY + 36, { width: rightMargin - leftMargin - 24, ellipsis: true })

    doc.y = decisionY + 65
    doc.moveDown(1)

    // Footer, Verification QR & Signatures
    const footY = doc.page.height - 76
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4338ca')
    doc.text('OFFICIALLY VERIFIED ACADEMIC RECORD', leftMargin, footY)
    doc.font('Helvetica').fontSize(7).fillColor('#64748b')
    doc.text(`Certificate No: ${data.verification.certificateNo}`, leftMargin, footY + 11)
    doc.text(`Issued On: ${new Date(data.generatedAt).toLocaleDateString()}  •  Office: ${data.verification.issuer}`, leftMargin, footY + 21, { width: 280, ellipsis: true })
    doc.text(`Scan QR code with any camera to verify authenticity online.`, leftMargin, footY + 31)

    // Embedded QR Code
    const qrX = rightMargin - 195
    doc.image(qrBuffer, qrX, footY - 6, { width: 44 })
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#475569')
    doc.text('SCAN TO VERIFY', qrX - 4, footY + 41, { width: 52, align: 'center' })

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
    doc.text('CONTROLLER OF EXAMINATIONS', rightMargin - 130, footY + 12, { width: 130, align: 'right' })
    doc.font('Helvetica').fontSize(7).fillColor('#64748b')
    doc.text('Northbridge University', rightMargin - 130, footY + 23, { width: 130, align: 'right' })

    doc.end()
  })
}
