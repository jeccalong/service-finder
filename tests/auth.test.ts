import { SELF, env, applyD1Migrations } from 'cloudflare:test'
import { describe, it, expect, beforeAll } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password'
import { emailDomain } from '../src/lib/domain-verify'

// Baseline fixtures live in beforeAll so they are visible to every test;
// per-test writes are rolled back by the pool's isolated storage.
const STAFF_DOMAIN = 'school.test'
const ADMIN_EMAIL = 'admin@svc.test'
const ADMIN_PASSWORD = 'admin-pw-12345'

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO registered_staff_domains (id, domain, school_name, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind('dom_staff_test', STAFF_DOMAIN, 'Test School', now)
    .run()
  await env.DB.prepare(
    `INSERT INTO admins (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind('admin_test', ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD), 'Test Admin', now)
    .run()
})

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const post = (path: string, body: unknown) =>
  SELF.fetch(`http://localhost${path}`, json(body))

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(stored.startsWith('pbkdf2$')).toBe(true)
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(await verifyPassword('wrong password', stored)).toBe(false)
  })

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })
})

describe('emailDomain', () => {
  it('extracts and lowercases the domain', () => {
    expect(emailDomain('Jane@School.Test')).toBe('school.test')
    expect(emailDomain('not-an-email')).toBe('')
  })
})

describe('org signup + login', () => {
  it('creates an org with status pending', async () => {
    const res = await post('/api/auth/org/signup', {
      email: 'org-a@example.test',
      password: 'org-password-1',
      name: 'Org A',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; status: string }
    expect(body.status).toBe('pending')

    const row = await env.DB.prepare(`SELECT status, ein_status FROM orgs WHERE id = ?`)
      .bind(body.id)
      .first<{ status: string; ein_status: string }>()
    expect(row?.status).toBe('pending')
    expect(row?.ein_status).toBe('pending')
  })

  it('logs in and stores a session token in KV', async () => {
    await post('/api/auth/org/signup', {
      email: 'org-b@example.test',
      password: 'org-password-2',
      name: 'Org B',
    })
    const res = await post('/api/auth/org/login', {
      email: 'org-b@example.test',
      password: 'org-password-2',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string; accountType: string }
    expect(body.accountType).toBe('org')

    const session = await env.SESSIONS.get(`session:${body.token}`)
    expect(session).toBeTruthy()
    expect(JSON.parse(session!).accountType).toBe('org')
  })

  it('rejects login with a wrong password', async () => {
    await post('/api/auth/org/signup', {
      email: 'org-c@example.test',
      password: 'org-password-3',
      name: 'Org C',
    })
    const res = await post('/api/auth/org/login', {
      email: 'org-c@example.test',
      password: 'not-the-password',
    })
    expect(res.status).toBe(401)
  })
})

describe('school staff signup', () => {
  it('auto-verifies a registered domain', async () => {
    const res = await post('/api/auth/staff/signup', {
      email: `teacher@${STAFF_DOMAIN}`,
      password: 'staff-password-1',
      name: 'Reg Teacher',
      school_name: 'Test School',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { verification_status: string }
    expect(body.verification_status).toBe('auto_verified')
  })

  it('flags an unregistered domain as pending_manual', async () => {
    const res = await post('/api/auth/staff/signup', {
      email: 'teacher@unknown.test',
      password: 'staff-password-2',
      name: 'Unknown Teacher',
      school_name: 'Some School',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { verification_status: string }
    expect(body.verification_status).toBe('pending_manual')
  })
})

describe('school staff login with OTP', () => {
  async function signupStaff(email: string) {
    await post('/api/auth/staff/signup', {
      email,
      password: 'staff-login-pw',
      name: 'Login Teacher',
      school_name: 'Test School',
    })
  }

  async function startLogin(email: string) {
    const res = await post('/api/auth/staff/login', { email, password: 'staff-login-pw' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { challenge: string; otpRequired: boolean }
    expect(body.otpRequired).toBe(true)
    return body.challenge
  }

  it('issues an OTP without a session, then completes login on a valid code', async () => {
    const email = `otp-ok@${STAFF_DOMAIN}`
    await signupStaff(email)
    const challenge = await startLogin(email)

    // The OTP is in KV; no session exists yet.
    const otpRaw = await env.SESSIONS.get(`otp:${challenge}`)
    expect(otpRaw).toBeTruthy()
    const code = JSON.parse(otpRaw!).code as string

    const verify = await post('/api/auth/staff/verify-otp', { challenge, code })
    expect(verify.status).toBe(200)
    const body = (await verify.json()) as { token: string; accountType: string }
    expect(body.accountType).toBe('school_staff')
    const session = await env.SESSIONS.get(`session:${body.token}`)
    expect(session).toBeTruthy()
  })

  it('rejects an invalid OTP code', async () => {
    const email = `otp-bad@${STAFF_DOMAIN}`
    await signupStaff(email)
    const challenge = await startLogin(email)

    const verify = await post('/api/auth/staff/verify-otp', { challenge, code: '000000' })
    // 000000 could in theory be the real code; guard against the 1-in-a-million.
    const otpRaw = await env.SESSIONS.get(`otp:${challenge}`)
    if (otpRaw && JSON.parse(otpRaw).code === '000000') return
    expect(verify.status).toBe(401)
  })

  it('rejects an expired/unknown challenge', async () => {
    const verify = await post('/api/auth/staff/verify-otp', {
      challenge: 'does-not-exist',
      code: '123456',
    })
    expect(verify.status).toBe(401)
  })

  it('makes the OTP single use', async () => {
    const email = `otp-single@${STAFF_DOMAIN}`
    await signupStaff(email)
    const challenge = await startLogin(email)
    const code = JSON.parse((await env.SESSIONS.get(`otp:${challenge}`))!).code as string

    const first = await post('/api/auth/staff/verify-otp', { challenge, code })
    expect(first.status).toBe(200)
    const second = await post('/api/auth/staff/verify-otp', { challenge, code })
    expect(second.status).toBe(401)
  })
})

describe('protected routes', () => {
  it('rejects /api/me without a token', async () => {
    const res = await SELF.fetch('http://localhost/api/me')
    expect(res.status).toBe(401)
  })

  it('accepts /api/me with a valid token', async () => {
    await post('/api/auth/org/signup', {
      email: 'me@example.test',
      password: 'me-password-1',
      name: 'Me Org',
    })
    const login = await post('/api/auth/org/login', {
      email: 'me@example.test',
      password: 'me-password-1',
    })
    const { token } = (await login.json()) as { token: string }

    const res = await SELF.fetch('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { account: { email: string } }
    expect(body.account.email).toBe('me@example.test')
  })
})

describe('admin', () => {
  it('logs in with seeded credentials', async () => {
    const res = await post('/api/auth/admin/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string; accountType: string }
    expect(body.accountType).toBe('admin')
  })

  it('reaches /admin/* with an admin token', async () => {
    const login = await post('/api/auth/admin/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
    const { token } = (await login.json()) as { token: string }
    const res = await SELF.fetch('http://localhost/admin/ping', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('returns 401 to /admin/* without a token', async () => {
    const res = await SELF.fetch('http://localhost/admin/ping')
    expect(res.status).toBe(401)
  })

  it('returns 403 to /admin/* for a non-admin account', async () => {
    await post('/api/auth/org/signup', {
      email: 'notadmin@example.test',
      password: 'org-password-9',
      name: 'Not Admin',
    })
    const login = await post('/api/auth/org/login', {
      email: 'notadmin@example.test',
      password: 'org-password-9',
    })
    const { token } = (await login.json()) as { token: string }
    const res = await SELF.fetch('http://localhost/admin/ping', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })
})
