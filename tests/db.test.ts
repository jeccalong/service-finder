import { describe, it, expect, beforeAll } from 'vitest'
import { env, applyD1Migrations } from 'cloudflare:test'

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
})

describe('schema', () => {
  it('creates all expected tables', async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name"
    ).all<{ name: string }>()

    const tables = result.results.map((r) => r.name)
    expect(tables).toEqual([
      'admins',
      'inquiries',
      'listings',
      'orgs',
      'registered_staff_domains',
      'registered_student_domains',
      'school_staff_accounts',
    ])
  })
})

describe('foreign keys', () => {
  it('rejects inquiry with a non-existent listing_id', async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO inquiries (id, listing_id, student_email, student_name, message, verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind('inq_fk_test', 'no_such_listing', 's@example.com', 'Student', 'hi', 1, Date.now())
        .run(),
    ).rejects.toThrow()
  })
})

describe('listings poster CHECK constraint', () => {
  it('rejects an org listing that also sets school_staff_id', async () => {
    const now = Date.now()
    await env.DB.prepare(
      `INSERT INTO orgs (id, email, password_hash, name, status, ein_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind('org_check', 'check@org.test', 'hash', 'Check Org', 'approved', 'verified', now)
      .run()

    await env.DB.prepare(
      `INSERT INTO school_staff_accounts
       (id, email, password_hash, name, school_name, email_domain, verification_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind('staff_check', 'check@staff.test', 'hash', 'Check Staff', 'School', 'staff.test', 'auto_verified', now)
      .run()

    await expect(
      env.DB.prepare(
        `INSERT INTO listings
         (id, title, description, category, listing_type, location, status,
          poster_type, org_id, school_staff_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind('l_check', 't', 'd', 'cat', 'shift', 'loc', 'pending', 'org', 'org_check', 'staff_check', now, now)
        .run(),
    ).rejects.toThrow()
  })

  it('rejects an org listing with no org_id', async () => {
    const now = Date.now()
    await expect(
      env.DB.prepare(
        `INSERT INTO listings
         (id, title, description, category, listing_type, location, status,
          poster_type, org_id, school_staff_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind('l_check2', 't', 'd', 'cat', 'shift', 'loc', 'pending', 'org', null, null, now, now)
        .run(),
    ).rejects.toThrow()
  })
})

describe('domain tables are independent', () => {
  it('keeps student and staff domains in separate tables', async () => {
    const now = Date.now()
    await env.DB.prepare(
      `INSERT INTO registered_staff_domains (id, domain, school_name, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind('sd_staff', 'school.test', 'Test School', now)
      .run()

    await env.DB.prepare(
      `INSERT INTO registered_student_domains (id, domain, school_name, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind('sd_student', 'stu.school.test', 'Test School', now)
      .run()

    const staffHit = await env.DB.prepare(
      `SELECT 1 FROM registered_staff_domains WHERE domain = ?`,
    )
      .bind('school.test')
      .first()
    const studentHit = await env.DB.prepare(
      `SELECT 1 FROM registered_student_domains WHERE domain = ?`,
    )
      .bind('stu.school.test')
      .first()
    expect(staffHit).toBeTruthy()
    expect(studentHit).toBeTruthy()

    const crossA = await env.DB.prepare(
      `SELECT 1 FROM registered_staff_domains WHERE domain = ?`,
    )
      .bind('stu.school.test')
      .first()
    const crossB = await env.DB.prepare(
      `SELECT 1 FROM registered_student_domains WHERE domain = ?`,
    )
      .bind('school.test')
      .first()
    expect(crossA).toBeNull()
    expect(crossB).toBeNull()
  })
})

describe('account types match PRD', () => {
  it('orgs require an EIN status and an approval status', async () => {
    const now = Date.now()
    await env.DB.prepare(
      `INSERT INTO orgs (id, email, password_hash, name, ein, ein_status, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind('org_prd', 'prd@org.test', 'hash', 'PRD Org', '11-1111111', 'verified', 'approved', now)
      .run()

    const row = await env.DB.prepare(`SELECT ein_status, status FROM orgs WHERE id = ?`)
      .bind('org_prd')
      .first<{ ein_status: string; status: string }>()
    expect(row?.ein_status).toBe('verified')
    expect(row?.status).toBe('approved')
  })

  it('listings only accept the three expected statuses', async () => {
    const now = Date.now()
    await env.DB.prepare(
      `INSERT INTO orgs (id, email, password_hash, name, status, ein_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind('org_status', 'status@org.test', 'hash', 'Status Org', 'approved', 'verified', now)
      .run()

    await expect(
      env.DB.prepare(
        `INSERT INTO listings
         (id, title, description, category, listing_type, location, status,
          poster_type, org_id, school_staff_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind('l_bad_status', 't', 'd', 'cat', 'shift', 'loc', 'in_review', 'org', 'org_status', null, now, now)
        .run(),
    ).rejects.toThrow()
  })
})
