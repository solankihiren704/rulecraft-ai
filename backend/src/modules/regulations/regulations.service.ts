import crypto from 'node:crypto'
import type { RegulationStatus } from '@prisma/client'
import { ApiError } from '@/middleware/errorHandler'
import { findById as findProgramById } from '@/modules/programs/programs.repository'
import type { Role } from '@/types'
import * as repo from './regulations.repository'
import { toRegulation } from './regulations.mapper'
import type { CreateRegulationInput, ListRegulationsQuery, UpdateRegulationInput } from './regulations.validators'

const STAFF_WITH_FULL_VISIBILITY: Role[] = ['super_admin', 'registrar', 'hod']

function visibleStatusesFor(role: Role): RegulationStatus[] | undefined {
  return STAFF_WITH_FULL_VISIBILITY.includes(role) ? undefined : ['published']
}

export async function list(query: ListRegulationsQuery, role: Role) {
  const rows = await repo.list({ ...query, visibleStatuses: visibleStatusesFor(role) })
  return rows.map(toRegulation)
}

export async function getById(id: string, role: Role) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')

  const visible = visibleStatusesFor(role)
  if (visible && !visible.includes(row.status)) {
    throw new ApiError(404, 'Regulation not found')
  }
  return toRegulation(row)
}

async function assertProgramExists(programId: string) {
  const program = await findProgramById(programId)
  if (!program) throw new ApiError(400, 'That program does not exist.', { programId: 'Invalid program.' })
}

async function assertCodeAvailable(code: string) {
  const existing = await repo.findByCode(code)
  if (existing) throw new ApiError(409, `Code "${code}" is already in use.`, { code: 'Already in use.' })
}

export async function create(input: CreateRegulationInput, createdById: string) {
  await assertProgramExists(input.programId)
  await assertCodeAvailable(input.code)
  const row = await repo.create(input, createdById)
  return toRegulation(row)
}

async function getOwnedDraftOrThrow(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'draft') {
    throw new ApiError(409, 'Published regulations are immutable. Duplicate this regulation to make changes.')
  }
  return row
}

export async function update(id: string, input: UpdateRegulationInput) {
  const current = await getOwnedDraftOrThrow(id)
  await assertProgramExists(input.programId)
  if (input.code !== current.code) await assertCodeAvailable(input.code)
  const row = await repo.update(id, input)
  return toRegulation(row)
}

export async function remove(id: string) {
  await getOwnedDraftOrThrow(id)
  await repo.remove(id)
}

export async function submit(id: string, byId: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'draft') throw new ApiError(409, `Cannot submit a regulation that is already "${row.status}".`)

  await repo.setStatus(id, 'review')
  await repo.addApprovalStep(id, 'submitted', byId, 'Submitted for HOD/Council review.')
  return toRegulation((await repo.findById(id))!)
}

export async function review(id: string, byId: string, note: string | undefined) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be reviewed.')

  await repo.addApprovalStep(id, 'reviewed', byId, note)
  return toRegulation((await repo.findById(id))!)
}

function bumpMinorVersion(version: string) {
  const [major, minor] = version.split('.').map(Number)
  return `${major}.${(minor || 0) + 1}`
}

export async function approve(id: string, byId: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be approved.')

  const nextVersion = bumpMinorVersion(row.version)
  await repo.publishNewVersion(id, nextVersion, 'Approved and published by Academic Council.', byId)
  await repo.addApprovalStep(id, 'approved', byId)
  return toRegulation((await repo.findById(id))!)
}

export async function reject(id: string, byId: string, note: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status !== 'review') throw new ApiError(409, 'Only regulations under review can be rejected.')

  await repo.setStatus(id, 'draft')
  await repo.addApprovalStep(id, 'rejected', byId, note)
  return toRegulation((await repo.findById(id))!)
}

export async function archive(id: string) {
  const row = await repo.findById(id)
  if (!row) throw new ApiError(404, 'Regulation not found')
  if (row.status === 'archived') throw new ApiError(409, 'This regulation is already archived.')

  const updated = await repo.setStatus(id, 'archived')
  return toRegulation(updated)
}

export async function duplicate(id: string, createdById: string) {
  const source = await repo.findById(id)
  if (!source) throw new ApiError(404, 'Regulation not found')

  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  const newCode = `${source.code}-COPY-${suffix}`
  const created = await repo.duplicate(id, newCode, createdById)
  return toRegulation(created!)
}
