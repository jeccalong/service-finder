-- Org accounts: email/password, admin-approved, gated on EIN verification
CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  ein TEXT,
  ein_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ein_status IN ('pending', 'verified', 'failed', 'manual_review')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL
);

-- School staff accounts: auto-verified if email domain matches a registered staff domain
CREATE TABLE school_staff_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  verification_status TEXT NOT NULL
    CHECK (verification_status IN ('auto_verified', 'pending_manual', 'approved', 'rejected')),
  created_at INTEGER NOT NULL
);

-- Platform admins
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Service opportunities posted by either an org or a school staff member.
-- The CHECK constraint enforces exactly one of org_id / school_staff_id is set.
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('shift', 'project')),
  location TEXT NOT NULL,
  image_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  poster_type TEXT NOT NULL CHECK (poster_type IN ('org', 'school_staff')),
  org_id TEXT REFERENCES orgs(id) ON DELETE CASCADE,
  school_staff_id TEXT REFERENCES school_staff_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (poster_type = 'org' AND org_id IS NOT NULL AND school_staff_id IS NULL)
    OR
    (poster_type = 'school_staff' AND school_staff_id IS NOT NULL AND org_id IS NULL)
  )
);

CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_org ON listings(org_id);
CREATE INDEX idx_listings_staff ON listings(school_staff_id);

-- Inquiries from students. Students do not have accounts.
-- verified=1 iff student_email's domain is in registered_student_domains at submission time.
CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name TEXT NOT NULL,
  message TEXT NOT NULL,
  verified INTEGER NOT NULL CHECK (verified IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_inquiries_listing ON inquiries(listing_id);

-- Registered student email domains (e.g. stu.riverbend.example).
-- Kept separate from staff domains so a student domain cannot accidentally
-- auto-verify a staff account.
CREATE TABLE registered_student_domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  school_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Registered staff email domains (e.g. riverbend.example).
CREATE TABLE registered_staff_domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  school_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
