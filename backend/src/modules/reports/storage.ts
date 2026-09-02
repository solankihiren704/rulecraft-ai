import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { env } from '@/config/env'

/**
 * storage.ts
 * The only place that knows how a generated report file is actually
 * persisted. Today STORAGE_DRIVER is always 'local' (files under
 * STORAGE_LOCAL_PATH/reports), validated in config/env.ts — a future 'S3'
 * driver would branch here without touching reports.service.ts, which only
 * ever deals in opaque storageKey strings.
 */

const baseDir = path.resolve(env.STORAGE_LOCAL_PATH, 'reports')

async function ensureBaseDir() {
  await fs.mkdir(baseDir, { recursive: true })
}

export async function saveReportFile(extension: string, content: Buffer): Promise<string> {
  await ensureBaseDir()
  const storageKey = `${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(baseDir, storageKey), content)
  return storageKey
}

export async function readReportFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(path.join(baseDir, storageKey))
}

export async function deleteReportFile(storageKey: string): Promise<void> {
  await fs.rm(path.join(baseDir, storageKey), { force: true })
}
