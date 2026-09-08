import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'

/**
 * academic-structure.import.ts
 * File-format-aware code for the bulk hierarchy import — mirrors
 * students.import.ts's role/shape exactly (parse rows in, build a template
 * out), just with more columns since one row can describe a full
 * department -> program -> semester -> subject path at once.
 */
export interface RawImportRow {
  row: number
  values: Record<string, string>
}

const HEADER_ALIASES: Record<string, string> = {
  departmentcode: 'departmentCode',
  deptcode: 'departmentCode',
  departmentname: 'departmentName',
  deptname: 'departmentName',
  programcode: 'programCode',
  programname: 'programName',
  programyears: 'programYears',
  years: 'programYears',
  semestername: 'semesterName',
  semesteryear: 'semesterYear',
  semesterstartdate: 'semesterStart',
  semesterstart: 'semesterStart',
  semesterenddate: 'semesterEnd',
  semesterend: 'semesterEnd',
  subjectcode: 'subjectCode',
  subjectname: 'subjectName',
  subjectcredits: 'subjectCredits',
  credits: 'subjectCredits',
}

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// exceljs's CSV parser auto-infers date-shaped strings ("2026-01-01") as
// real Date values — harmless for xlsx (where `cell.text` still renders the
// original), but for CSV, `cell.text` on an inferred Date returns its full
// toString() ("Thu Jan 01 2026 00:00:00 GMT+0530 ..."), silently breaking
// the YYYY-MM-DD format the semester date fields require. Reconstruct it
// from the Date directly instead — via LOCAL getters, not UTC: verified
// against the actual parser that it builds the Date from local-time
// components (not `new Date("2026-01-01")`'s UTC-midnight ISO parsing), so
// UTC getters silently shift the date by a day for any positive UTC offset.
function cellText(cell: ExcelJS.Cell): string {
  if (cell.value instanceof Date) {
    const d = cell.value
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return cell.text?.trim() ?? String(cell.value ?? '').trim()
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
    // See students.import.ts for why this cast exists — a type-only
    // mismatch between exceljs's Buffer type and this project's, not a
    // real runtime issue.
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
      const text = cellText(cell)
      if (text) values[key] = text
    })
    if (Object.keys(values).length > 0) rows.push({ row: rowNumber, values })
  })

  return rows
}

export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RuleCraft AI'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Academic Structure')
  sheet.columns = [
    { header: 'Department Code', key: 'departmentCode', width: 16 },
    { header: 'Department Name', key: 'departmentName', width: 24 },
    { header: 'Program Code', key: 'programCode', width: 14 },
    { header: 'Program Name', key: 'programName', width: 24 },
    { header: 'Program Years', key: 'programYears', width: 14 },
    { header: 'Semester Name', key: 'semesterName', width: 16 },
    { header: 'Semester Year', key: 'semesterYear', width: 14 },
    { header: 'Semester Start Date', key: 'semesterStart', width: 18 },
    { header: 'Semester End Date', key: 'semesterEnd', width: 18 },
    { header: 'Subject Code', key: 'subjectCode', width: 14 },
    { header: 'Subject Name', key: 'subjectName', width: 24 },
    { header: 'Subject Credits', key: 'subjectCredits', width: 14 },
  ]
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  })

  // Three example rows showing the flexible depth: a department-only row,
  // a row that also creates a program, and a full department->subject row —
  // repeating a department/program code across rows reuses it instead of
  // erroring, which is how you'd actually build out a semester's subjects.
  sheet.addRow({ departmentCode: 'CS', departmentName: 'Computer Science' })
  sheet.addRow({ departmentCode: 'CS', departmentName: 'Computer Science', programCode: 'BTCS', programName: 'B.Tech Computer Science', programYears: 4 })
  sheet.addRow({
    departmentCode: 'CS',
    departmentName: 'Computer Science',
    programCode: 'BTCS',
    programName: 'B.Tech Computer Science',
    programYears: 4,
    semesterName: 'Semester 1',
    semesterYear: 1,
    semesterStart: '2026-08-01',
    semesterEnd: '2026-12-15',
    subjectCode: 'CS101',
    subjectName: 'Introduction to Programming',
    subjectCredits: 4,
  })
  for (let i = 2; i <= 4; i++) {
    sheet.getRow(i).eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF94A3B8' } }
    })
  }

  const notes = workbook.addWorksheet('How this works')
  notes.columns = [{ header: '', key: 'note', width: 100 }]
  ;[
    'Each row can describe as much or as little of the hierarchy as you want — a department alone, department + program, or all the way down to a subject.',
    'Leave Semester/Subject columns blank to only create/reuse a Department and Program from that row.',
    'A Semester requires a Program on the same row; a Subject requires a Semester on the same row.',
    'Department and Program codes are reused when repeated across rows — you do not need to repeat a program\'s full row for every subject in it beyond what identifies the department/program.',
    'Dates must be in YYYY-MM-DD format, and the semester end date must be after the start date.',
  ].forEach((note) => notes.addRow([note]))

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
