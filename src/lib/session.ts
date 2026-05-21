// KV-backed sessions. A login mints a random opaque token; the account it maps
// to lives in KV under `session:<token>` and expires automatically via TTL.

import type { AccountType, SessionAccount } from '../types'

const PREFIX = 'session:'

// Session lifetimes in seconds. Orgs get a long-lived session; school staff
// re-authenticate more often because their shorter window pairs with the
// login OTP that proves ongoing access to the school inbox. Admin is kept
// short because it is the most privileged account.
export const SESSION_TTL: Record<AccountType, number> = {
  org: 7 * 24 * 60 * 60, // 7 days
  school_staff: 8 * 60 * 60, // 8 hours
  admin: 8 * 60 * 60, // 8 hours
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  // base64url so the token is safe in headers without escaping.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createSession(
  kv: KVNamespace,
  account: SessionAccount,
): Promise<string> {
  const token = randomToken()
  await kv.put(PREFIX + token, JSON.stringify(account), {
    expirationTtl: SESSION_TTL[account.accountType],
  })
  return token
}

export async function getSession(
  kv: KVNamespace,
  token: string,
): Promise<SessionAccount | null> {
  if (!token) return null
  const raw = await kv.get(PREFIX + token)
  if (!raw) return null
  return JSON.parse(raw) as SessionAccount
}

export async function destroySession(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(PREFIX + token)
}
