import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'

/**
 * students.import.ts
 * Turns an uploaded .xlsx/.csv roster into row objects the service can
 * validate, and builds the downloadable template in the other direction —
 * mirrors reports.render.ts's role of being the only file-format-aware code
 * in the module.
 */
export interface RawImportRow {
  row: number
  values: Record<string, string>
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  fullname: 'name',
  studentname: 'name',
  email: 'email',
  emailaddress: 'email',
  studentid: 'studentId',
  id: 'studentId',
  rollno: 'studentId',
  rollnumber: 'studentId',
  program: 'programCode',
  programcode: 'programCode',
  code: 'programCode',
  programname: 'programName',
  branch: 'departmentName',
  department: 'departmentName',
  departmentname: 'departmentName',
  dept: 'departmentName',
  deptname: 'departmentName',
  departmentcode: 'departmentCode',
  deptcode: 'departmentCode',
  year: 'year',
  status: 'status',
  gpa: 'gpa',
  cgpa: 'gpa',
  attendance: 'attendance',
  attendancepercent: 'attendance',
  attendancepercentage: 'attendance',
  att: 'attendance',
  presence: 'attendance',
}

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function parseImportRows(buffer: Buffer, filename: string): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook()
  if (filename.toLowerCase().endsWith('.csv')) {
    const stream = new Readable({
      read() {
        this.push(buffer)
        this.push(null)
      },
    })
    await workbook.csv.read(stream)
  } else {
    // exceljs resolves its Buffer parameter type against a stale nested
    // @types/node (pulled in transitively via fast-csv, one of its own
    // dependencies) rather than this project's — a type-only mismatch
    // between two structurally-different Buffer declarations, not a real
    // runtime issue, since it's the same Node.js Buffer either way.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const columns: (string | undefined)[] = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = String(cell.value ?? '').trim()
    columns[colNumber] = raw ? HEADER_ALIASES[normalizeHeader(raw)] : undefined
  })

  const rows: RawImportRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values: Record<string, string> = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = columns[colNumber]
      if (!key) return
      const text = cell.text?.trim() ?? String(cell.value ?? '').trim()
      if (text) values[key] = text
    })
    // Skip fully blank rows (trailing empty rows are common in exported sheets).
    if (Object.keys(values).length > 0) rows.push({ row: rowNumber, values })
  })

  return rows
}

export interface ProgramReference {
  code: string
  name: string
  departmentName: string
}

export async function buildImportTemplate(programs: ProgramReference[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RuleCraft AI'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Students')
  sheet.columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Student ID', key: 'studentId', width: 18 },
    { header: 'Program Code', key: 'programCode', width: 16 },
    { header: 'Department (Optional)', key: 'departmentName', width: 26 },
    { header: 'Program Name (Optional)', key: 'programName', width: 30 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'GPA', key: 'gpa', width: 8 },
    { header: 'Attendance % (Optional)', key: 'attendance', width: 22 },
  ]
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  })

  const exampleCode = programs[0]?.code ?? 'BTME'
  sheet.addRow({
    name: 'Rahul Sharma',
    email: 'rahul.sharma@university.edu',
    studentId: 'STU-2026-001',
    programCode: exampleCode,
    departmentName: 'Mechanical Engineering',
    programName: 'B.Tech Mechanical Engineering',
    year: 1,
    status: 'active',
    gpa: 8.5,
    attendance: 88,
  })
  sheet.getRow(2).eachCell((cell) => {
    cell.font = { italic: true, color: { argb: 'FF94A3B8' } }
  })

  const ref = workbook.addWorksheet('Program codes (reference)')
  ref.columns = [
    { header: 'Program Code', key: 'code', width: 16 },
    { header: 'Program Name', key: 'name', width: 32 },
    { header: 'Department', key: 'departmentName', width: 28 },
  ]
  ref.getRow(1).font = { bold: true }
  programs.forEach((p) => ref.addRow(p))
  if (programs.length === 0) {
    ref.addRow({ code: '—', name: 'No programs match this filter', departmentName: '' })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export interface StudentCredentialRow {
  studentId: string
  name: string
  email: string
  departmentName?: string
  programName?: string
  year: number
  tempPassword?: string
}

export async function buildCredentialsWorkbook(
  students: StudentCredentialRow[],
  portalUrl = 'http://localhost:5173',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RuleCraft AI'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Student Login Credentials')
  sheet.columns = [
    { header: 'Student ID / Roll No', key: 'studentId', width: 22 },
    { header: 'Full Name', key: 'name', width: 26 },
    { header: 'Department', key: 'departmentName', width: 26 },
    { header: 'Program', key: 'programName', width: 28 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Login Email', key: 'email', width: 30 },
    { header: 'Default Password', key: 'password', width: 18 },
    { header: 'Portal Login URL', key: 'portalUrl', width: 28 },
    { header: 'Login Note', key: 'note', width: 40 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.height = 24
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })

  students.forEach((s) => {
    sheet.addRow({
      studentId: s.studentId,
      name: s.name,
      departmentName: s.departmentName || '—',
      programName: s.programName || '—',
      year: s.year,
      email: s.email,
      password: s.tempPassword || 'Demo@1234',
      portalUrl,
      note: 'Log in with Roll No or Email; change pass on 1st login.',
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
