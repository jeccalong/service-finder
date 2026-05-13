# Service Finder

A community service opportunity platform for high school and college students with mandatory service hour requirements. Students browse local, age-appropriate opportunities posted by verified nonprofits and school staff — and contact them without a phone call.

**Current status:** Phase 0 (scaffolding) complete. Worker deployed with `/health` smoke test.

## Project links

🔗 **Live site:** https://service-finder.jeccaj.workers.dev
🎥 **PRD video:** _coming soon_
🎥 **Demo video:** _coming soon_

## What this solves

Students in rural communities can't find local service opportunities. Existing platforms (VolunteerMatch, Idealist) are urban-focused and list opportunities inappropriate for minors. Teachers field the same question from every student and don't have good answers. This platform gives students a searchable, school-endorsed list of real opportunities — and a way to reach organizations after school hours.

## Who it's for

| User | What they do |
|---|---|
| Students | Browse and filter listings, submit inquiries via email (no account required) |
| Organizations | Post volunteer needs (shifts or student-led projects), receive inquiry notifications |
| School staff | Post school-based opportunities as verified affiliates of their institution |
| Admin | Approve listings, verify org EINs, register school email domains |

## Docs

- [`docs/PRD.md`](docs/PRD.md) — full product requirements
- [`docs/DESIGN.md`](docs/DESIGN.md) — UI/UX design brief (phone-first, Cloudflare Pages + React + Tailwind)
- [`docs/BUILDPLAN.md`](docs/BUILDPLAN.md) — seven-phase horizontal build plan

## Tech stack

| Layer | Technology |
|---|---|
| UI | React + Headless UI + Tailwind CSS, hosted on Cloudflare Pages |
| API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 |
| Sessions | Cloudflare KV |
| Email | Resend |

## Build phases

| Phase | Goal | Status |
|---|---|---|
| 0 — Scaffolding | Cloudflare bootstrap, smoke test, deploy | ✅ Done |
| 1 — Data layer | D1 schema, migrations, seed data | Not started |
| 2 — Auth | Login, sessions, school staff 2FA, domain verification | Not started |
| 3 — Listing management | Org/staff posting, R2 image upload, dashboard | Not started |
| 4 — Admin dashboard | Listing approval, EIN verification, domain registration | Not started |
| 5 — Public browse + inquiry | Hero screen, listing grid, inquiry form, email notifications | Not started |
| 6 — Polish | Stock images, about page, demo data, mobile refinements | Not started |

## Built with

This project was built as part of [AI Foundations: Architecting the Next Generation of Apps](https://bumbolio.github.io/agentic-coding-starter/), using the [agentic-coding-starter](https://github.com/Bumbolio/agentic-coding-starter) template and Claude Code.
