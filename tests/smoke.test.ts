import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('GET /health returns 200', async () => {
    const res = await SELF.fetch('http://localhost/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('ok')
  })
})
