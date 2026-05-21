// School-staff domain verification. A staff signup auto-verifies only when the
// email's domain is on the admin-maintained list of registered staff domains;
// otherwise it is flagged for manual admin review.

export type StaffDomainResult = 'auto_verified' | 'pending_manual'

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at === -1) return ''
  return email.slice(at + 1).trim().toLowerCase()
}

export async function verifyStaffDomain(
  db: D1Database,
  email: string,
): Promise<StaffDomainResult> {
  const domain = emailDomain(email)
  if (!domain) return 'pending_manual'
  const hit = await db
    .prepare('SELECT 1 FROM registered_staff_domains WHERE domain = ?')
    .bind(domain)
    .first()
  return hit ? 'auto_verified' : 'pending_manual'
}
