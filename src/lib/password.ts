// Password hashing for the Workers runtime using WebCrypto PBKDF2.
// No third-party dependency — SubtleCrypto is built into the runtime.
//
// Stored format is self-describing so the cost parameters can change later
// without invalidating existing hashes:
//   pbkdf2$<iterations>$<saltBase64>$<hashBase64>

const ITERATIONS = 100_000
const KEY_LEN_BITS = 256
const SALT_BYTES = 16
const DIGEST = 'SHA-256'

const enc = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: DIGEST },
    baseKey,
    KEY_LEN_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  const actual = await derive(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

// Constant-time comparison so we don't leak how many leading bytes matched.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
