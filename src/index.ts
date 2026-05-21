import { Hono } from 'hono'
import type { AppEnv } from './types'
import authRoutes from './routes/auth'
import { requireAdmin, requireAuth } from './middleware/auth'

const app = new Hono<AppEnv>()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', authRoutes)

// Probe routes exercised by the auth tests. Real feature routes land in later
// phases (listings in Phase 3, admin actions in Phase 4).
app.get('/api/me', requireAuth, (c) => c.json({ account: c.get('account') }))
app.get('/admin/ping', requireAdmin, (c) => c.json({ ok: true, account: c.get('account') }))

export default app
