// Session-validation middleware. Reads a bearer token, looks the session up in
// KV, and attaches the account to the context for downstream handlers.

import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { getSession } from '../lib/session'
import type { AppEnv } from '../types'

function bearerToken(c: Context<AppEnv>): string {
  const header = c.req.header('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// Any logged-in account. 401 if there is no valid session.
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const account = await getSession(c.env.SESSIONS, bearerToken(c))
  if (!account) return c.json({ error: 'unauthorized' }, 401)
  c.set('account', account)
  await next()
})

// Admin only. 401 if unauthenticated, 403 if authenticated but not an admin.
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const account = await getSession(c.env.SESSIONS, bearerToken(c))
  if (!account) return c.json({ error: 'unauthorized' }, 401)
  if (account.accountType !== 'admin') return c.json({ error: 'forbidden' }, 403)
  c.set('account', account)
  await next()
})
