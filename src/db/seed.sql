-- Development seed data. Password hashes are placeholders — Phase 2 will
-- replace these with real bcrypt hashes. Do not use this seed in production.

-- Admin
INSERT INTO admins (id, email, password_hash, name, created_at) VALUES
  ('admin_01', 'admin@service-finder.test', 'PLACEHOLDER_HASH', 'Demo Admin', 1715000000000);

-- Registered domains (one staff, one student, both for the same district)
INSERT INTO registered_staff_domains (id, domain, school_name, created_at) VALUES
  ('domain_staff_01', 'corbin.kyschools.us', 'Corbin Independent School', 1715000000000);

INSERT INTO registered_student_domains (id, domain, school_name, created_at) VALUES
  ('domain_student_01', 'stu.corbin.kyschools.us', 'Corbin Independent School', 1715000000000);

-- One approved org
INSERT INTO orgs (id, email, password_hash, name, ein, ein_status, status, created_at) VALUES
  ('org_01', 'contact@laurel-food-bank.test', 'PLACEHOLDER_HASH',
   'Laurel County Food Bank', '12-3456789', 'verified', 'approved', 1715000000000);

-- One auto-verified school staff member
INSERT INTO school_staff_accounts
  (id, email, password_hash, name, school_name, email_domain, verification_status, created_at)
VALUES
  ('staff_01', 'jsmith@corbin.kyschools.us', 'PLACEHOLDER_HASH',
   'Jane Smith', 'Corbin Independent School', 'corbin.kyschools.us',
   'auto_verified', 1715000000000);

-- Three listings: one org shift (approved), one school project (pending),
-- one school shift (approved). Mix of statuses so dashboards have variety.
INSERT INTO listings
  (id, title, description, category, listing_type, location, image_key,
   status, poster_type, org_id, school_staff_id, created_at, updated_at)
VALUES
  ('listing_01',
   'Pack food boxes for weekend distribution',
   'Help pack 200 food boxes for families in need every Saturday morning. No experience needed; we provide gloves and training.',
   'food_bank', 'shift', 'London, KY', NULL,
   'approved', 'org', 'org_01', NULL, 1715000000000, 1715000000000),

  ('listing_02',
   'Lead a school-wide recycling drive',
   'Design and run a month-long recycling drive at Corbin High. Looking for a student leader to plan logistics, recruit volunteers, and present results to admin.',
   'environment', 'project', 'Corbin, KY', NULL,
   'pending', 'school_staff', NULL, 'staff_01', 1715000000000, 1715000000000),

  ('listing_03',
   'Tutor middle schoolers in algebra',
   'Weekly after-school tutoring session in the school library. Tuesdays and Thursdays, 3:30-4:30 PM.',
   'tutoring', 'shift', 'Corbin, KY', NULL,
   'approved', 'school_staff', NULL, 'staff_01', 1715000000000, 1715000000000);
