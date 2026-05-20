# Build Plan

> **Status:** Draft
> **Last updated:** 2026-05-13
> **Current phase:** Phase 2 (Phases 0–1 complete)

---

## Why a build plan exists

Claude Code sessions have a finite context window. The cheaper a session is to start, the better the work tends to be. A good build plan slices the project into phases where each phase:

- Has a single user-visible outcome.
- Touches a bounded set of files.
- Names exactly which docs and files Claude should load to execute it.
- Leaves the repo in a clean, testable state at the end.

---

## Strategy

- **Slicing principle:** Horizontal — foundational layers first (schema → auth), then feature layers on top. Chosen because auth infrastructure is shared by three account types (org, school staff, admin), and getting it wrong would require rework across all feature phases.
- **Critical path:** Phase 1 (data layer) and Phase 2 (auth) unblock everything else. No feature phase can start until both are green.
- **What was deferred on purpose:** EIN automation, email notifications, and the public-facing UI are all deferred until the supply side (listing management) and verification pipeline (admin) are working. The student experience is built last because it depends on real listings existing.
- **Session boundaries:** Start every phase with `/clear`. Load only what the `Context to load` line specifies — nothing else.

---

## Phases

---

### Phase 0 — Scaffolding

**Goal:** Repo bootstrapped, Cloudflare Workers + Pages project deployed to a public URL with a passing smoke test.

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §6, `docs/DESIGN.md` §3.

**Files this phase creates/modifies:**
- `wrangler.toml` — Workers + D1 + R2 + KV bindings declared
- `package.json` — dependencies (Hono, Vitest, @cloudflare/vitest-pool-workers, Tailwind, React)
- `src/index.ts` — Hono app entry point, single `/health` route
- `vitest.config.ts` — test runner configured for Workers runtime
- `README.md` — placeholder for deployed URL, video links

**Tests this phase adds:**
- `tests/smoke.test.ts` — GET `/health` returns 200.

**Done-when:**
- [ ] `npm test` passes.
- [ ] `wrangler deploy` produces a public URL.
- [ ] URL is in `README.md`.
- [ ] D1, R2, and KV bindings are declared in `wrangler.toml` (even if not yet used).

**Session budget:** ~1 session.

**Risks / unknowns:** Wrangler auth, Node version mismatches, Cloudflare account setup. Solve these before writing any feature code.

---

### Phase 1 — Data layer

**Goal:** Full D1 schema defined and migrated; seed data populates cleanly; all tables match the PRD auth and listing model.

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §4 (all stories), §6 (auth model, tech shape), `wrangler.toml`.

**Files this phase creates/modifies:**
- `migrations/0001_initial.sql` — creates tables: `orgs`, `school_staff_accounts`, `listings`, `inquiries`, `registered_student_domains`, `registered_staff_domains`, `admins`
- `src/db/schema.ts` — TypeScript types mirroring each table
- `src/db/seed.sql` — development seed data (1 org, 1 school staff, 3 listings)
- `tests/db.test.ts` — schema integrity tests

**Tests this phase adds:**
- Schema applies without errors.
- All FK constraints are enforced.
- Seed data inserts and queries correctly.
- `registered_student_domains` and `registered_staff_domains` are separate tables with distinct domain entries.

**Done-when:**
- [ ] `wrangler d1 migrations apply` runs without errors.
- [ ] Seed data populates via `wrangler d1 execute`.
- [ ] `npm test` passes.
- [ ] Schema matches the four account types in PRD §6: orgs (EIN field), school staff (email domain field), admins, and listings (status: pending/approved/rejected).

**Session budget:** 1 session.

**Risks / unknowns:** D1 FK enforcement behavior (D1 supports FK constraints but they must be explicitly enabled with `PRAGMA foreign_keys = ON`). Listing status enum — use a CHECK constraint rather than a separate table.

---

### Phase 2 — Auth

**Goal:** Orgs and school staff can create accounts and log in; school staff are auto-verified by email domain or flagged for admin review; admin account exists and can access protected routes.

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §6 (auth model), `migrations/0001_initial.sql`, `src/db/schema.ts`.

**Files this phase creates/modifies:**
- `src/routes/auth.ts` — signup and login routes for orgs and school staff
- `src/middleware/auth.ts` — session validation middleware for protected routes
- `src/lib/session.ts` — KV-backed session token creation and validation
- `src/lib/domain-verify.ts` — checks email domain against `registered_staff_domains`; returns `auto_verified` or `pending_manual`
- `src/lib/password.ts` — bcrypt hashing helpers
- `src/lib/otp.ts` — generates and validates a short-lived OTP sent to school staff's registered email at login (2FA step)
- `tests/auth.test.ts` — auth flow tests

**2FA model for school staff:** School staff log in with email/password, then receive a one-time code at their registered school email. They must enter the code to complete login. This proves ongoing access to the school email address, solving the stale-account problem (deactivated school email = can't receive OTP = can't log in). OTP expires after 10 minutes. Org accounts do not require 2FA in v1.

**Tests this phase adds:**
- Org can sign up; account created with `status: pending` (pending EIN verification).
- School staff can sign up with a registered domain; account auto-verified.
- School staff can sign up with an unregistered domain; account flagged `pending_manual`.
- School staff login sends OTP to registered email; valid OTP completes login; expired/invalid OTP rejects.
- Login returns a valid session token stored in KV.
- Protected route rejects request without valid session token.
- Admin login succeeds with seeded admin credentials.

**Done-when:**
- [ ] Org and school staff signup routes work.
- [ ] Domain-based auto-verification logic is tested and correct.
- [ ] School staff 2FA flow works end-to-end (OTP sent, validated, session issued).
- [ ] Session tokens issue on login and are validated by middleware.
- [ ] Admin can reach `/admin/*` routes; unauthenticated requests get 401.
- [ ] `npm test` passes.

**Session budget:** 1–2 sessions.

**Risks / unknowns:** KV session TTL — decide on expiry (suggest 7 days for orgs, 8 hours for school staff given 2FA). Password hashing in the Workers runtime (use `bcryptjs`, not native `bcrypt`). Admin account seeded via SQL, not signup flow — document this in README. OTP delivery depends on Resend being configured — set up Resend account before this session.

---

### Phase 3 — Listing management

**Goal:** Logged-in orgs and school staff can post, edit, and delete listings with images; listings appear in their dashboard as "pending approval."

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §4 stories 2–3, `docs/DESIGN.md` §2 (`/dashboard`), §3 (component approach), §4 (color + type tokens), `src/middleware/auth.ts`, `src/db/schema.ts`.

**Files this phase creates/modifies:**
- `src/routes/listings.ts` — CRUD routes for listings (POST, GET, PUT, DELETE), protected by auth middleware
- `src/routes/upload.ts` — R2 presigned URL generation for image uploads
- `src/components/ListingForm.tsx` — create/edit form (title, description, category, type: shift vs. project, location, image upload)
- `src/components/Dashboard.tsx` — logged-in user's listing list with status badges
- `src/components/ListingCard.tsx` — reusable card (used here and in Phase 5 public browse)
- `tests/listings.test.ts` — listing CRUD tests
- `tests/upload.test.ts` — R2 upload tests

**Tests this phase adds:**
- Authenticated org can create a listing; it gets status `pending`.
- Authenticated school staff can create a listing; it gets status `pending`.
- Unauthenticated request to create listing returns 401.
- Org can edit and delete only their own listings.
- R2 presigned URL generates successfully.
- Dashboard query returns only listings belonging to the logged-in user.

**Done-when:**
- [ ] Org and school staff can post a listing with an image.
- [ ] New listings appear in dashboard with `pending` status badge.
- [ ] Edit and delete work for own listings only.
- [ ] Image uploads reach R2 successfully.
- [ ] `npm test` passes.

**Session budget:** 1–2 sessions.

**Risks / unknowns:** R2 presigned URL flow in the Workers runtime (fetch the Cloudflare R2 docs before writing upload code). Image size limits — enforce a max on the Worker, not just the frontend. `ListingCard` built here will be reused in Phase 5 — keep it stateless and prop-driven.

---

### Phase 4 — Admin dashboard

**Goal:** Admin can approve or reject listings, run EIN verification on orgs, and register school staff and student email domains.

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §4 story 4, §6 (EIN verification, domain model), `docs/DESIGN.md` §2 (`/admin`), `src/middleware/auth.ts`, `src/db/schema.ts`, `migrations/0001_initial.sql`.

**Files this phase creates/modifies:**
- `src/routes/admin.ts` — admin-only routes: list pending listings, approve, reject, list pending org accounts, register domains
- `src/lib/ein-verify.ts` — calls IRS/public registry API; returns verified/failed/ambiguous
- `src/components/AdminDashboard.tsx` — tabbed view: pending listings, pending org accounts, domain management
- `tests/admin.test.ts` — admin action tests
- `tests/ein-verify.test.ts` — EIN lookup tests (mock the external API)

**Tests this phase adds:**
- Admin can approve a pending listing; status changes to `approved`.
- Admin can reject a pending listing; status changes to `rejected`.
- EIN lookup returns `verified` for a valid EIN.
- EIN lookup failure flags org account as `manual_review` rather than blocking signup.
- Admin can register a new staff domain; subsequent school staff signups from that domain auto-verify.
- Admin can register a new student domain; subsequent student inquiries from that domain get `verified` flag.
- Non-admin user cannot reach `/admin/*` routes.

**Done-when:**
- [ ] Admin can see and act on all pending listings.
- [ ] EIN verification runs on org account creation; failures are visible in admin dashboard.
- [ ] Admin can add staff and student domains independently.
- [ ] `npm test` passes.

**Session budget:** 1–2 sessions.

**Risks / unknowns:** EIN API — research the IRS EIN verification endpoint or a service like Open990 before this phase. If the API is unreliable, implement a 24-hour cache in KV. Fetch `https://developers.cloudflare.com/llms.txt` for current KV documentation before writing cache code.

---

### Phase 5 — Public browse + student inquiry

**Goal:** Students can browse approved listings, filter by location or school, view a listing detail, and submit an inquiry that notifies the org or school staff by email.

**Context to load:** `CLAUDE.md`, `docs/PRD.md` §4 story 1, §6 (student inquiry model, email), `docs/DESIGN.md` §2 (`/` and `/listing/:id`), §3 (Combobox, ListingCard), §4 (all tokens), §5 (accessibility floor), §6 (responsive), `src/components/ListingCard.tsx`.

**Files this phase creates/modifies:**
- `src/routes/public.ts` — unauthenticated routes: list approved listings (with filters), get single listing
- `src/routes/inquiry.ts` — POST inquiry; initiates student session verification if no valid session exists; checks student email domain against `registered_student_domains`; sends email via Resend
- `src/lib/student-session.ts` — creates a short-lived session token for students after they verify their email via a link (token stored in KV, expires after 1 hour)
- `src/lib/email.ts` — Resend API wrapper (new inquiry notification, submission confirmation)
- `src/components/HeroSearch.tsx` — location/school picker using Headless UI `Combobox`
- `src/components/ListingGrid.tsx` — responsive card grid (1 col mobile → 2 col md → 3 col lg)
- `src/components/ListingDetail.tsx` — full listing view
- `src/components/InquiryForm.tsx` — student contact form with email field
- `tests/public.test.ts` — browse and filter tests
- `tests/inquiry.test.ts` — inquiry submission and email flag tests

**Student session verification model:** A student who hasn't verified their email this session is prompted to enter their email address. A verification link is sent via Resend; clicking it sets a 1-hour session token in KV tied to that email. The student can then submit inquiries without re-verifying until the session expires. Domain check (registered vs. unregistered) still runs at inquiry submission time.

**Tests this phase adds:**
- Public listing route returns only `approved` listings.
- Filter by location returns matching listings only.
- Filter by school returns listings posted by that school's staff.
- Student without a valid session is prompted to verify email before submitting inquiry.
- Student with a valid session can submit inquiry without re-verifying.
- Inquiry from a registered student domain gets `verified: true` in the database.
- Inquiry from an unregistered domain gets `verified: false`.
- Resend notification is triggered on inquiry submission (mock Resend in tests).
- Inquiry form rejects submission if no email is provided.

**Done-when:**
- [ ] Student can browse approved listings on `/`.
- [ ] Location/school picker filters the listing grid.
- [ ] Listing detail page (`/listing/:id`) shows full info and inquiry form.
- [ ] Unverified student is prompted to verify email before submitting; verified student submits without re-verifying for 1 hour.
- [ ] Submitted inquiry appears in the org/school staff dashboard with Verified or Unverified badge.
- [ ] Org or school staff receives an email notification.
- [ ] `npm test` passes.
- [ ] Listing grid is single-column on mobile, multi-column on tablet+.

**Session budget:** 1–2 sessions.

**Risks / unknowns:** Resend API setup — create account and get API key before the session. Email deliverability for school-district addresses — test with a real address before demo. The Combobox location/school picker needs real data (locations from listings, school names from `registered_staff_domains`) — query these in the route, not hardcoded.

---

### Phase 6 — Polish

**Goal:** Demo-ready — stock image fallbacks by category, about page, realistic dummy data, mobile refinements, README complete.

**Context to load:** `CLAUDE.md`, `docs/DESIGN.md` §1 (visual identity), §6 (responsive), §8 (out of scope — check nothing is added accidentally), `README.md`.

**Files this phase creates/modifies:**
- `src/lib/stock-images.ts` — maps listing category to a default image URL (images stored in R2)
- `src/pages/About.tsx` — platform explainer for orgs and schools considering signing up
- `src/db/demo-seed.sql` — 5+ realistic dummy listings across multiple categories, 2 dummy orgs, 1 dummy school staff account
- `README.md` — deployed URL, PRD video link, demo video link, "what I'd do differently" paragraph

**Tests this phase adds:**
- Listing without an uploaded image renders the category default image.
- About page loads and returns 200.

**Done-when:**
- [ ] Listings without uploaded images show a relevant category default.
- [ ] About page explains the platform and links to signup.
- [ ] Demo seed data populates 5+ realistic listings.
- [ ] README has the live URL and both required video links.
- [ ] `npm test` passes.
- [ ] Architecture diagram regenerated and committed to `docs/architecture.md`.

**Session budget:** 1 session.

**Risks / unknowns:** Stock images — source from a free library (Unsplash, Pexels) and store in R2 ahead of this session. About page copy — write it before the session so you're not doing copywriting and coding at the same time.

---

## Decision log

| Date | Phase touched | Change | Reason |
|---|---|---|---|
| 2026-05-07 | All | Initial plan | Horizontal slicing chosen because auth infrastructure is shared by three account types |
| 2026-05-07 | Phase 2, 5 | Added 2FA for school staff (email OTP at login) and student session verification (verify once per hour via email link) | Rubber-duck quiz surfaced that domain-based auto-verification alone doesn't handle deactivated school emails; per-action verification was too high friction |
| 2026-05-20 | Phase 1, 4 (open) | **TBD before Phase 4:** revisit `ON DELETE CASCADE` on `listings.org_id`, `listings.school_staff_id`, and `inquiries.listing_id`. Likely replace with soft-delete on `orgs`/`school_staff_accounts` (add `deleted_at`) and `ON DELETE RESTRICT` on `inquiries.listing_id`. | Rubber-duck quiz on Phase 1 surfaced that cascading an org delete also wipes every student inquiry sent to that org — destroying the audit trail exactly when it matters most (e.g. org removed for misconduct). Wrong default for a student-safety platform. Decide before writing admin delete actions in Phase 4. |

---

## Handoff notes

The project is done when:

- Public URL deployed to Cloudflare and linked from `README.md`.
- All Must-have user stories from `docs/PRD.md` §4 have green tests.
- PRD explainer video (≤5 min) linked from `README.md`.
- Demo video (≤5 min) linked from `README.md`.
- Architecture diagram regenerated and committed to `docs/architecture.md`.
- "What I'd do differently" paragraph in `README.md`.
