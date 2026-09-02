import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

describe('GET /api/health', () => {
  const app = createApp()

  it('returns 200 with a success payload', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})
