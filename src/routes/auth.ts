// Signup and login routes for orgs, school staff, and admins.
//
// Login policy: orgs (pending EIN) and pending_manual staff may still log in;
// gating who can *post* is Phase 3. Rejected accounts cannot log in.

import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { hashPassword, verifyPassword } from '../lib/password'
import { createSession } from '../lib/session'
import { emailDomain, verifyStaffDomain } from '../lib/domain-verify'
import { consoleEmailSender, issueOtp, verifyOtp } from '../lib/otp'

const auth = new Hono<AppEnv>()

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
const normalizeEmail = (email: string) => email.trim().toLowerCase()

// ---------------------------------------------------------------------------
// Orgs
// ---------------------------------------------------------------------------

auth.post('/org/signup', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: string
    password?: string
    name?: string
    ein?: string
  } | null
  if (!body?.email || !body.password || !body.name) {
    return c.json({ error: 'email, password, and name are required' }, 400)
  }

  const id = newId('org')
  const password_hash = await hashPassword(body.password)
  try {
    await c.env.DB.prepare(
      `INSERT INTO orgs (id, email, password_hash, name, ein, ein_status, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
    )
      .bind(id, normalizeEmail(body.email), password_hash, body.name, body.ein ?? null, Date.now())
      .run()
  } catch {
    return c.json({ error: 'email already registered' }, 409)
  }
  return c.json({ id, status: 'pending' }, 201)
})

auth.post('/org/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: string
    password?: string
  } | null
  if (!body?.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const org = await c.env.DB.prepare(
    `SELECT id, email, password_hash, status FROM orgs WHERE email = ?`,
  )
    .bind(normalizeEmail(body.email))
    .first<{ id: string; email: string; password_hash: string; status: string }>()

  // Same response for unknown email and wrong password so we don't confirm
  // which accounts exist. (Timing-based enumeration is an accepted v1 tradeoff.)
  if (!org || !(await verifyPassword(body.password, org.password_hash))) {
    return c.json({ error: 'invalid credentials' }, 401)
  }
  if (org.status === 'rejected') {
    return c.json({ error: 'account rejected' }, 403)
  }

  const token = await createSession(c.env.SESSIONS, {
    accountType: 'org',
    accountId: org.id,
    email: org.email,
  })
  return c.json({ token, accountType: 'org' })
})

// ---------------------------------------------------------------------------
// School staff
// ---------------------------------------------------------------------------

auth.post('/staff/signup', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: string
    password?: string
    name?: string
    school_name?: string
  } | null
  if (!body?.email || !body.password || !body.name || !body.school_name) {
    return c.json({ error: 'email, password, name, and school_name are required' }, 400)
  }

  const verification_status = await verifyStaffDomain(c.env.DB, body.email)
  const id = newId('staff')
  const password_hash = await hashPassword(body.password)
  try {
    await c.env.DB.prepare(
      `INSERT INTO school_staff_accounts
        (id, email, password_hash, name, school_name, email_domain, verification_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        normalizeEmail(body.email),
        password_hash,
        body.name,
        body.school_name,
        emailDomain(body.email),
        verification_status,
        Date.now(),
      )
      .run()
  } catch {
    return c.json({ error: 'email already registered' }, 409)
  }
  return c.json({ id, verification_status }, 201)
})

// Login step 1: verify password, then issue + "send" an OTP. No session yet.
auth.post('/staff/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: string
    password?: string
  } | null
  if (!body?.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const staff = await c.env.DB.prepare(
    `SELECT id, email, password_hash, verification_status
     FROM school_staff_accounts WHERE email = ?`,
  )
    .bind(normalizeEmail(body.email))
    .first<{ id: string; email: string; password_hash: string; verification_status: string }>()

  if (!staff || !(await verifyPassword(body.password, staff.password_hash))) {
    return c.json({ error: 'invalid credentials' }, 401)
  }
  if (staff.verification_status === 'rejected') {
    return c.json({ error: 'account rejected' }, 403)
  }

  const challenge = await issueOtp(c.env.SESSIONS, consoleEmailSender, {
    id: staff.id,
    email: staff.email,
  })
  return c.json({ challenge, otpRequired: true })
})

// Login step 2: exchange a valid OTP for a session.
auth.post('/staff/verify-otp', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    challenge?: string
    code?: string
  } | null
  if (!body?.challenge || !body.code) {
    return c.json({ error: 'challenge and code are required' }, 400)
  }

  const result = await verifyOtp(c.env.SESSIONS, body.challenge, body.code)
  if (!result.ok) {
    return c.json({ error: result.reason }, 401)
  }

  const token = await createSession(c.env.SESSIONS, {
    accountType: 'school_staff',
    accountId: result.staffId,
    email: result.email,
  })
  return c.json({ token, accountType: 'school_staff' })
})

// ---------------------------------------------------------------------------
// Admin (seeded via SQL, not signup)
// ---------------------------------------------------------------------------

auth.post('/admin/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: string
    password?: string
  } | null
  if (!body?.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const admin = await c.env.DB.prepare(
    `SELECT id, email, password_hash FROM admins WHERE email = ?`,
  )
    .bind(normalizeEmail(body.email))
    .first<{ id: string; email: string; password_hash: string }>()

  if (!admin || !(await verifyPassword(body.password, admin.password_hash))) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const token = await createSession(c.env.SESSIONS, {
    accountType: 'admin',
    accountId: admin.id,
    email: admin.email,
  })
  return c.json({ token, accountType: 'admin' })
})

export default auth
