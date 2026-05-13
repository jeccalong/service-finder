import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  IMAGES: R2Bucket
  SESSIONS: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
