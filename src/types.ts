// Shared types for the Worker. Bindings mirror wrangler.toml; Variables are
// the per-request values middleware attaches to the Hono context.

export type Bindings = {
  DB: D1Database
  IMAGES: R2Bucket
  SESSIONS: KVNamespace
}

export type AccountType = 'org' | 'school_staff' | 'admin'

// What we store in KV for a logged-in session and read back in middleware.
export type SessionAccount = {
  accountType: AccountType
  accountId: string
  email: string
}

export type Variables = {
  account: SessionAccount
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
