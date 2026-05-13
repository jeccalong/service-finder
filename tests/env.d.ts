declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    IMAGES: R2Bucket
    SESSIONS: KVNamespace
    TEST_MIGRATIONS: import('@cloudflare/vitest-pool-workers/config').D1Migration[]
  }
}

export {}
