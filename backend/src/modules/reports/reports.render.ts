import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

/**
 * reports.render.ts
 * Turns one format-agnostic ReportPayload into an actual CSV/PDF/Excel file
 * buffer. The payload itself (what the report says) is built in
 * reports.service.ts from real Prisma queries — this file only knows how to
 * lay it out per format, never where the numbers came from.
 */
export interface ReportPayload {
  title: string
  subtitle: string
  generatedAt: Date
  generatedBy: string
  notes: string[]
  summary: { label: string; value: string | number }[]
  tableTitle: string
  tableColumns: string[]
  tableRows: (string | number)[][]
}

export function renderCsv(payload: ReportPayload): Buffer {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines: string[] = []
  lines.push(`# ${payload.title}`)
  lines.push(`# ${payload.subtitle}`)
  lines.push(`# Generated ${payload.generatedAt.toISOString()} by ${payload.generatedBy}`)
  lines.push('')
  lines.push('Summary')
  payload.summary.forEach((s) => lines.push(`${escape(s.label)},${escape(s.value)}`))
  if (payload.notes.length) {
    lines.push('')
    lines.push('Notes')
    payload.notes.forEach((n) => lines.push(escape(n)))
  }
  lines.push('')
  lines.push(payload.tableTitle)
  lines.push(payload.tableColumns.map(escape).join(','))
  payload.tableRows.forEach((row) => lines.push(row.map(escape).join(',')))
  return Buffer.from(lines.join('\r\n'), 'utf-8')
}

export async function renderExcel(payload: ReportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RuleCraft AI'
  workbook.created = payload.generatedAt
  const sheet = workbook.addWorksheet('Report')

  sheet.addRow([payload.title]).font = { bold: true, size: 14 }
  sheet.addRow([payload.subtitle])
  sheet.addRow([`Generated ${payload.generatedAt.toLocaleString()} by ${payload.generatedBy}`])
  sheet.addRow([])

  sheet.addRow(['Summary']).font = { bold: true }
  payload.summary.forEach((s) => sheet.addRow([s.label, s.value]))

  if (payload.notes.length) {
    sheet.addRow([])
    sheet.addRow(['Notes']).font = { bold: true }
    payload.notes.forEach((n) => sheet.addRow([n]))
  }

  sheet.addRow([])
  sheet.addRow([payload.tableTitle]).font = { bold: true }
  sheet.addRow(payload.tableColumns).font = { bold: true }
  payload.tableRows.forEach((row) => sheet.addRow(row))

  sheet.columns.forEach((col) => {
    col.width = 24
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export function renderPdf(payload: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).fillColor('#102b35').text(payload.title)
    doc.fontSize(10).fillColor('#557071').text(payload.subtitle)
    doc.moveDown(0.3)
    doc.fontSize(8).fillColor('#9aa8a5').text(`Generated ${payload.generatedAt.toLocaleString()} by ${payload.generatedBy}`)
    doc.moveDown(1)

    doc.fontSize(12).fillColor('#102b35').text('Summary', { underline: true })
    doc.moveDown(0.3)
    payload.summary.forEach((s) => {
      doc.fontSize(10).fillColor('#173640').text(`${s.label}: ${s.value}`)
    })

    if (payload.notes.length) {
      doc.moveDown(0.8)
      doc.fontSize(10).fillColor('#b94e37').text('Notes')
      payload.notes.forEach((n) => doc.fontSize(9).fillColor('#b94e37').text(`- ${n}`))
    }

    doc.moveDown(1)
    doc.fontSize(12).fillColor('#102b35').text(payload.tableTitle, { underline: true })
    doc.moveDown(0.4)

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const colWidth = usableWidth / Math.max(payload.tableColumns.length, 1)
    const startX = doc.page.margins.left
    let y = doc.y

    function drawRow(cells: (string | number)[], bold: boolean) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(bold ? '#102b35' : '#486362')
      cells.forEach((cell, i) => {
        doc.text(String(cell), startX + i * colWidth, y, { width: colWidth - 6, ellipsis: true })
      })
      y += 16
      if (y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        y = doc.page.margins.top
      }
    }

    drawRow(payload.tableColumns, true)
    if (payload.tableRows.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#9aa8a5').text('No matching records.', startX, y)
    } else {
      payload.tableRows.forEach((row) => drawRow(row, false))
    }

    doc.end()
  })
}
