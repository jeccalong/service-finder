// School-staff login 2FA. After a correct password we email a 6-digit code to
// the registered school address; entering it proves the person still controls
// that inbox. The code lives in KV under a random challenge id with a short
// TTL, single use, and a cap on guesses.
//
// The code is stored in plaintext on purpose. Hashing a 6-digit secret buys
// nothing: anyone who could read KV could brute-force all 10^6 codes instantly.
// Security comes from the short TTL, single use, and attempt cap instead.

export interface EmailSender {
  sendOtp(to: string, code: string): Promise<void>
}

// Phase 2 stub. Phase 5 swaps in a Resend-backed sender (src/lib/email.ts).
export const consoleEmailSender: EmailSender = {
  async sendOtp(to, code) {
    console.log(`[otp] would send code ${code} to ${to}`)
  },
}

const PREFIX = 'otp:'
const TTL_SECONDS = 10 * 60
const MAX_ATTEMPTS = 5
const MIN_KV_TTL = 60 // KV rejects expirationTtl below 60 seconds

type OtpRecord = {
  code: string
  staffId: string
  email: string
  attempts: number
  expiresAt: number // epoch ms; the authoritative expiry independent of KV TTL
}

function randomChallenge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

export async function issueOtp(
  kv: KVNamespace,
  sender: EmailSender,
  staff: { id: string; email: string },
): Promise<string> {
  const challenge = randomChallenge()
  const record: OtpRecord = {
    code: randomCode(),
    staffId: staff.id,
    email: staff.email,
    attempts: 0,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  }
  await kv.put(PREFIX + challenge, JSON.stringify(record), {
    expirationTtl: TTL_SECONDS,
  })
  await sender.sendOtp(staff.email, record.code)
  return challenge
}

export type OtpResult =
  | { ok: true; staffId: string; email: string }
  | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts' }

export async function verifyOtp(
  kv: KVNamespace,
  challenge: string,
  code: string,
): Promise<OtpResult> {
  const raw = await kv.get(PREFIX + challenge)
  if (!raw) return { ok: false, reason: 'expired' }
  const record = JSON.parse(raw) as OtpRecord

  if (Date.now() > record.expiresAt) {
    await kv.delete(PREFIX + challenge)
    return { ok: false, reason: 'expired' }
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await kv.delete(PREFIX + challenge)
    return { ok: false, reason: 'too_many_attempts' }
  }
  if (record.code !== code) {
    record.attempts += 1
    // Preserve the original window rather than resetting the TTL on each guess.
    const remaining = Math.max(MIN_KV_TTL, Math.ceil((record.expiresAt - Date.now()) / 1000))
    await kv.put(PREFIX + challenge, JSON.stringify(record), { expirationTtl: remaining })
    return { ok: false, reason: 'invalid' }
  }

  // Success: codes are single use, so burn it immediately.
  await kv.delete(PREFIX + challenge)
  return { ok: true, staffId: record.staffId, email: record.email }
}
