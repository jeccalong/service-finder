# Design Brief

_This file is the source of truth for UI/UX decisions on this project. Keep it short — a design brief is a compass, not a spec._

---

## 1. Visual identity

**Mood:** Straightforward, modern, intuitive, professional, young.

**Reference apps:**
- **Instagram** — card-based visual browsing, immediately familiar to a younger audience. Borrow the layout density and image-forward listing cards.
- **Waze** — genuinely useful and smart, but wrapped in a playful, colorful UI. Borrow the warmth and the sense that the app is working *for* you, not just presenting data.

**Anti-references:**
- **Gmail** — dated, text-heavy, gray-on-gray. No walls of text, no dense inbox UI, no government-form energy.

**Brand constraints:** None. Fresh project.

---

## 2. Information architecture

**Primary screens (top-level routes):**
- `/` — hero screen: location/school picker that funnels students to filtered listings
- `/listing/:id` — individual listing detail + student inquiry form
- `/about` — platform explainer for orgs and schools considering signing up
- `/login` — shared login + account creation for orgs and school staff
- `/dashboard` — org/school staff dashboard (post listings, view and respond to inquiries)
- `/admin` — admin dashboard (approve listings, manage registered school domains)

**Navigation model:** Nav tiles for primary entry points with a top nav bar. Collapses to a hamburger menu on mobile.

**The hero screen:** A location or school picker — one clear action, immediate payoff. Students should reach relevant listings in under 30 seconds. No marketing copy blocking the path. The `/about` page carries all the "what is this" explanation so the homepage stays ruthlessly focused.

---

## 3. Component approach

- **Framework:** React
- **Component library:** [Headless UI](https://headlessui.com/) — accessible unstyled primitives (Dialog, Menu, Combobox, Listbox, Disclosure, Tabs, etc.)
- **Styling:** Tailwind CSS
- **Icons:** Heroicons

**Custom components to build:**
- **Listing cards** — image, title, org/school name, category badge, shift vs. project tag. Single-column on mobile, multi-column grid on tablet+.
- **Location/school picker** — Headless UI `Combobox` on the hero screen.
- **Image uploader** — file input for org listing images; Headless UI doesn't cover this.
- **Verified/Unverified badge** — displayed on student inquiries in the dashboard inbox.

---

## 4. Visual tokens

**Color palette:**

| Role | Color | Hex |
|---|---|---|
| Page background | Cream | `#F6F1E9` |
| Primary text + dark surfaces | Navy | `#373557` |
| Primary accent + error states | Red-orange | `#FF4438` |
| Warnings, category badges, decorative highlights | Orange | `#FAA45E` |
| Links, info states, verified badge | Steel blue | `#3F83A3` |
| Success / confirmed states | Green | `#16a34a` |

**Error state rule:** Red-orange doubles as the error color. Error states must always pair the color with an icon and a text label — color is never the only signal.

**Type:**
- **Display / headings:** Gloock Regular (Google Fonts) — editorial, elegant, high contrast
- **Body / UI:** Inter (Google Fonts) — clean, highly readable at small sizes on mobile

**Spacing scale:** Tailwind defaults.

**Border radius:** `rounded-md` — applied consistently across all components.

**Shadow:** Use sparingly. One card elevation (`shadow-sm`) for listing cards; one modal elevation (`shadow-lg`) for dialogs.

---

## 5. Accessibility floor

All of the following are non-negotiable for v1:

- Keyboard navigable end-to-end.
- WCAG AA contrast on all text.
- All form inputs have visible labels — no placeholder-as-label.
- Focus states are visible and not removed.
- Color is never the only way to convey information (error states always include icon + text).

---

## 6. Responsive strategy

- **Breakpoints:** Tailwind defaults (`sm`, `md`, `lg`, `xl`).
- **Smallest target:** Phone-first. Default layout is single-column; complexity is added as screen size grows.
- **Key reflow:** Listing cards — single column on phone, 2-column grid at `md`, 3-column at `lg`.
- **Nav:** Top bar with nav tiles on desktop; collapses to hamburger on mobile.

---

## 7. Risks & unknowns

- **Ease of use is the adoption risk.** If a student can't find a relevant listing in under 30 seconds, the platform creates more friction than it removes. The hero screen's location/school picker is the highest-stakes UX decision in the app — get it right before building anything else.
- **Image-heavy cards on slow connections** — listing cards rely on images for visual appeal. Build in a lightweight placeholder (blur-up or skeleton) strategy from the start.
- **Two serifs was considered** (Gloock + Castoro) and rejected in favor of Gloock + Inter for better mobile readability.

---

## 8. Out of scope (for v1)

- Dark mode
- Animations beyond default Headless UI transitions
- Custom illustrations or icon system
- Social media profile picture integration
- Org/student rating UI
- Success story photo/text feeds
- Org-level preference to block unverified inquiries
