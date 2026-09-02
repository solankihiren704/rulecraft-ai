import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { authorize, assertInScope } from '../src/middleware/authorize'

function mockReq(user?: { id: string; role: string; departmentId: string | null }) {
  return { user } as unknown as Request
}

describe('authorize middleware', () => {
  it('calls next() when the user has an allowed role', () => {
    const next = vi.fn()
    authorize('super_admin', 'registrar')(mockReq({ id: 'u1', role: 'registrar', departmentId: null }), {} as Response, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('throws 403 when the role is not allowed', () => {
    expect(() =>
      authorize('super_admin')(mockReq({ id: 'u1', role: 'faculty', departmentId: null }), {} as Response, vi.fn()),
    ).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('throws 401 when there is no authenticated user', () => {
    expect(() => authorize('super_admin')(mockReq(undefined), {} as Response, vi.fn())).toThrowError(
      expect.objectContaining({ statusCode: 401 }),
    )
  })
})

describe('assertInScope', () => {
  it('lets super_admin and registrar through regardless of department', () => {
    expect(() => assertInScope({ role: 'super_admin', departmentId: null }, 'dept-x')).not.toThrow()
    expect(() => assertInScope({ role: 'registrar', departmentId: null }, 'dept-x')).not.toThrow()
  })

  it('lets HOD/Faculty through only for their own department', () => {
    expect(() => assertInScope({ role: 'hod', departmentId: 'dept-x' }, 'dept-x')).not.toThrow()
    expect(() => assertInScope({ role: 'faculty', departmentId: 'dept-x' }, 'dept-x')).not.toThrow()
  })

  it('blocks HOD/Faculty from a different department', () => {
    expect(() => assertInScope({ role: 'hod', departmentId: 'dept-x' }, 'dept-y')).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    )
  })

  it('blocks HOD with no department assigned at all', () => {
    expect(() => assertInScope({ role: 'hod', departmentId: null }, 'dept-y')).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    )
  })

  it('blocks student (self-scoping is handled separately, never via assertInScope)', () => {
    expect(() => assertInScope({ role: 'student', departmentId: null }, 'dept-x')).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    )
  })
})
