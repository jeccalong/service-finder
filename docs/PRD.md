# Product Requirements Document (PRD)

> **Status:** Draft
> **Last updated:** 2026-05-07
> **Author:** jeccalong
> **Stakeholder:** High school students, local nonprofits, school staff

---

## 1. The problem

High school (and college) students in rural communities have mandatory community service requirements — including large, student-led projects required for graduation — but no reliable, local, age-appropriate, school-endorsed place to find opportunities. Existing platforms like VolunteerMatch and Idealist are urban-focused and list opportunities inappropriate for minors (grant writers, foster parents, exchange student hosts). The fallback — asking teachers — breaks down because every student in the school has the same requirement and teachers don't have good answers. The pain is especially acute for students who need to design and lead a project, not just show up for a shift: an 8/10 pain level compared to a 4/10 for basic hour-logging.

---

## 2. The user

**Primary user — the student:**
- High school or college student with a mandatory service hour or project requirement
- Opens the app at home or school after being reminded by a teacher or parent
- Wants a list of local orgs and school-posted opportunities open to student-led projects, with async contact options (no phone calls — decision-makers are unavailable after school hours)
- Comfortable with a web app; uses phone and desktop

**Secondary user — the organization:**
- Local nonprofit, church, food bank, or similar
- Has real volunteer needs but no easy way to reach student volunteers
- Needs an account to post listings and respond to student inquiries
- Will check the platform when notified by email

**Secondary user — the school staff:**
- Teacher, counselor, or administrator with service opportunities available within the school (classroom help, fundraiser support, event setup, etc.)
- Creates a standard email/password account; auto-verified if their email domain matches a registered school staff domain; flagged for manual admin review if not
- Posts listings and receives student inquiries through the platform inbox, same as org users
- Could eventually serve as platform admin for their institution

---

## 3. What success looks like

- **Launch success metric:** 5 organizations post real service needs and 10 students complete hours sourced from the app.
- **Must-have outcome:** A student can find a local, age-appropriate opportunity, submit an inquiry using their school email address, and receive a response from the org — all without a phone call.
- **Nice-to-have outcome:** A teacher sends students a single link instead of fielding the same question repeatedly.
- **Not a goal:** Hour tracking, verification, or reporting to the school. That is v2.

---

## 4. Core user stories

1. **[Must]** As a student, I want to browse and search local service opportunities so that I can find something that satisfies my school requirement.
2. **[Must]** As an organization, I want to post my volunteer needs (shifts and/or student-led project opportunities) so that I can find students to help with real work.
3. **[Must]** As a school staff member, I want to post service opportunities available within my school so that students can find and log hours without leaving campus, and I can reduce the volume of students asking me the same question.
4. **[Must]** As an admin, I want to approve org and school listings before they go live so that students are only seeing vetted, safe opportunities.
5. **[Should]** As a teacher or counselor, I want to direct students to a single trusted source so that I don't have to answer the same question from every student.
6. **[Won't — this release]** As a student, I want to log and verify my completed hours in the app so that I can submit them to my school automatically.

---

## 5. Out of scope

- **Hour tracking and verification.** Students currently fill out a paper form signed by the org. Digitizing that workflow is v2.
- **Org and volunteer ratings.** Ratings need volume to be meaningful; v1 has neither.
- **Success story sharing.** Photo and text sharing from students is a content moderation problem and a minor privacy risk. v2.
- **Social media profile picture integration.** Fragile APIs, maintenance burden. Orgs upload an image or get a category default.
- **Full vetting/background checks.** EIN verification (automated lookup with manual fallback for failures) is the trust signal for v1.
- **Individual (non-org) listings.** v1 is orgs only. Individual vetted volunteers are a later consideration.

---

## 6. Technical shape

- **Type of app:** Full-stack web app. Public-facing listing browse (no auth required for students). Org and school staff dashboards behind standard login. Admin dashboard behind login.
- **Does it need to store data?** Yes — structured records (org profiles, listings, student inquiries) and files (org-uploaded images).
- **Does it need authentication?** Yes, for orgs, school staff, and admins. Students do not create accounts. Three account types:
  - **Org accounts:** email/password, admin-approved, gated on EIN verification (automated lookup, manual fallback)
  - **School staff accounts:** email/password, auto-verified if email domain matches a registered school staff domain; flagged for manual admin review if not. Admin maintains a list of registered school staff domains (e.g. `corbin.kyschools.us`) separate from student domains.
  - **Admin accounts:** email/password, full platform access.
  - **Students (no account):** submit inquiries via a contact form using any email. Inquiries from registered student domains (e.g. `stu.corbin.kyschools.us`) are marked "Verified Student" in the recipient's inbox; others are marked "Unverified."
- **Does it need to call external services?** Yes — EIN verification via IRS/public registry API (automated, with failures flagged for manual admin review), and a transactional email service to notify orgs of new inquiries and confirm student submissions.
- **Who pays for hosting?** Developer (Cloudflare free tier for v1).

### Proposed Cloudflare stack

| Need | CF Product | Why |
|---|---|---|
| Host the web UI (React + Tailwind) | Cloudflare Pages | Global deployment, generous free tier, integrates with Workers |
| Backend API logic | Workers + Hono | Handles listing CRUD, EIN verification calls, inquiry routing |
| Structured data | D1 | SQL database for orgs, listings, and inquiries — relational data fits naturally |
| Image storage | R2 | Stores org-uploaded images and category stock image defaults; no egress fees |
| Org session auth | KV | Fast global key-value store for session tokens |
| Transactional email | Resend or Mailgun (external) | Cloudflare Email Routing is for receiving, not sending; a transactional email API handles org notifications and student confirmations |

**Note:** EIN verification will use a public IRS or nonprofit registry API called from a Worker. Failures and ambiguous results are flagged in the admin dashboard for manual review rather than blocking the org outright.

---

## 7. Risks and unknowns

- **Biggest risk:** Organizations say they want volunteers but don't follow through — they don't post listings, or they don't respond to student inquiries within a reasonable window. Mitigation: personally recruit 3–5 orgs before launch and get a verbal commitment to respond within 48 hours.
- **Second risk:** Student safety. The platform's trust model (EIN verification + admin approval of listings + verified/unverified email flagging) is lightweight. If a bad actor gets through, the reputational damage could kill adoption. The admin approval step is the main human check.
- **Things I don't know how to do yet:** EIN lookup API integration; transactional email from a Worker; image upload to R2 from a browser.
- **Things I'm assuming but haven't verified:** Local nonprofits will actively post and maintain listings. Schools will whitelist the platform on their networks. Orgs are willing to respond to unverified inquiries (or at minimum, ignore them without friction). Student email domain formats vary widely by district — each must be registered manually at adoption time.
- **Won't build in v1:** Org-level preference to block unverified inquiries entirely. Add when there's enough org volume to know whether it's needed.

---

## 8. Milestones

- **Week 2 end:** Org can create an account, post a listing with an image (or category default), and have it appear on a public searchable list after admin approval. At least one dummy org listing deployed to Cloudflare.
- **Week 3 end:** Student can find a listing and submit an inquiry. Inquiry is marked Verified or Unverified based on registered school email domains. Org receives an email notification. EIN verification (automated + manual fallback) in place. Admin dashboard can approve/reject listings and register school email domains.
- **Week 4 demo:** Polish pass — stock image defaults by category, mobile-friendly UI, realistic dummy listings and inquiries. Demo shows the full flow: org posts → admin approves → student finds and contacts → org is notified.
