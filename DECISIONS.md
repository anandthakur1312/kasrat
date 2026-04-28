# Kasrat — Decisions Log

> **Purpose:** Every meaningful decision made on this project, with the *what*, the *why*, and the *justification* (the reasoning that backs the why). Use this as a single place to challenge or revisit any choice.
>
> **Scope:** Decisions extracted from the original product/spec sessions, the Phase 6 UI build, the Phase 7 backend build, and the Phase 8.5 auth + multi-tenancy build (sessions on 2026-04-26 and 2026-04-27).
>
> **Status legend:** 🔒 Locked — won't revisit unless evidence forces it. 🟡 Provisional — fine for pilot, may revisit at scale. 🔵 Pending — not yet decided.

---

## Table of contents

1. [Product shape](#1-product-shape)
2. [Tech stack](#2-tech-stack)
3. [Data model](#3-data-model)
4. [Build approach (mock-first)](#4-build-approach-mock-first)
5. [Auth & multi-tenancy (Phase 8.5)](#5-auth--multi-tenancy-phase-85)
6. [UI / UX conventions](#6-ui--ux-conventions)
7. [Implementation details surfaced during the build](#7-implementation-details-surfaced-during-the-build)
8. [Branding & domain](#8-branding--domain)
9. [Repository, tooling & workflow](#9-repository-tooling--workflow)
10. [Pending decisions (the 9 that are still open)](#10-pending-decisions)

---

## 1. Product shape

### 1.1 Web app, not native 🔒
- **What:** Build a responsive web app, not iOS/Android native apps.
- **Why:** Faster to ship; no app-store review; one codebase for owner and members.
- **Justification:** Owner is a single-person operator; native gives no real value for a CRUD app. Members never log in, they just scan a QR — they don't need an app at all. Mobile-friendliness is achieved via responsive design at ~375px width.

### 1.2 Members never log in 🔒
- **What:** Members access the gym only through a public page (`/g/:slug`) reached by scanning a QR sticker on the gym wall. Only the owner authenticates.
- **Why:** Roughly halves the scope of auth and avoids two user types.
- **Justification:** A 50–150-member gym can't onboard its members into yet another app. The realistic interaction is: member walks in, owner records payment; member scans QR to pay via UPI. No member-facing accounts means no password reset flows, no member profiles, no member-side notifications, no permissions matrix.

### 1.3 Pilot at one specific gym 🔒
- **What:** First customer is the family-owned gym in Sagar, Madhya Pradesh.
- **Why:** Removes the "who is the user" problem and gives us a real front desk to sit at.
- **Justification:** A live pilot with people we know means honest feedback, fast iteration, and zero pressure to monetize. Findings from Sagar generalize to other tier-2/3 Indian gyms.

### 1.4 Mobile-first at ~375px 🔒
- **What:** Design and engineer for ~375px-wide phone screens; scale up for desktop.
- **Why:** The owner uses this on a phone at the front desk.
- **Justification:** The pilot owner does not own a laptop he will use in the gym. Optimizing for desktop and then crunching down loses to designing at the smallest target first.

### 1.5 Bilingual (English + Hindi) from day 1 🔒
- **What:** Every user-facing string goes through `t('key')` from the very first commit; `en.json` and `hi.json` exist from scaffold onward.
- **Why:** Sagar is in the Hindi belt; Hindi is non-negotiable for owner adoption.
- **Justification:** Retrofitting i18n later is painful and error-prone — every JSX literal becomes a search-and-replace exercise. Putting the harness in upfront costs ~30 minutes; bolting it on later costs days.

### 1.6 Out of scope for v1 🔒
- **What:** Excluded explicitly: gym photos/videos, member attendance/check-ins, payment reminders to members, trainer/staff sub-accounts, reports beyond what's on screen, member profile fields beyond name+phone, phone+OTP login, payment-gateway integration (Razorpay/Cashfree), pricing tiers.
- **Why:** Pilot scope is "replace the pen-and-paper register." Anything beyond that delays launch.
- **Justification:** Any one of these is itself a 1–2-week feature. Shipping the boring core first lets us learn from the gym what's actually missing rather than guessing.

---

## 2. Tech stack

### 2.1 Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui 🔒
- **What:** React 18 with Vite 5 for the dev server and bundler, TypeScript everywhere, Tailwind 3 for styling, shadcn/ui for primitives copied into our repo (`components/ui/`).
- **Why:** Fastest, most predictable stack for a small team that isn't reinventing primitives.
- **Justification:** Vite gives instant HMR and a tiny prod bundle; shadcn/ui is library-free (you own the components), which matters because we can't take a dependency that gets abandoned mid-pilot. Tailwind is the lowest-friction way to design at 375px without writing a stylesheet for every component.

### 2.2 Routing: React Router 🔒
- **What:** `react-router-dom` v6 with `BrowserRouter`.
- **Why:** Default choice in the React ecosystem; everyone reading the code already knows it.
- **Justification:** TanStack Router and Wouter are technically nicer, but the project doesn't need their advanced features. Familiarity > novelty for a solo build.

### 2.3 i18n: react-i18next 🔒
- **What:** `react-i18next` with `en` and `hi` resource bundles in `src/locales/`. Pluralization uses the standard `_one` / `_other` suffixes.
- **Why:** Mature, plays well with React, supports plurals out of the box.
- **Justification:** `react-intl` is also fine, but `react-i18next` has lighter setup and the JSON resource format is the easiest thing to hand to a translator.

### 2.4 Backend: Node.js + TypeScript + Fastify + Prisma 🔒
- **What:** Fastify 5 as the HTTP server, Prisma 5 as the ORM, Zod for request validation. All routes live in one `server.ts` file.
- **Why:** Fastify is faster and lighter than Express with better TypeScript support; Prisma's type generation matches the contract-first approach.
- **Justification:** Fastify's `setErrorHandler` + Zod gives us a clean error pipeline (validation → 400, business → 4xx, unknown → 500) in ~10 lines. Keeping all routes in one file is intentional — when there are <30 endpoints, splitting hurts more than it helps.

### 2.5 Database: Postgres on Neon (prod) / SQLite (dev) 🔒
- **What:** Production target is Neon serverless Postgres; local dev uses SQLite via Prisma's identical query API.
- **Why:** Neon scales to zero (free tier covers the pilot indefinitely); SQLite gives a one-file dev DB with no setup.
- **Justification:** Neon supports Postgres RLS, point-in-time recovery, and branching — features we can grow into. SQLite locally avoids forcing every contributor to install Postgres just to type-check. Switching the Prisma datasource is one line in `schema.prisma` plus rerunning migrations.

### 2.6 Auth: Clerk (managed) 🔒
- **What:** Clerk handles all login flows (Google OAuth + Email/Password), session management, password reset, email verification.
- **Why:** Lucia v3 was deprecated to a "learning resource" by its maintainer in March 2025; Auth.js feels grafted-on for non-Next.js backends; rolling our own takes weeks.
- **Justification:** Clerk's free tier (10k MAU) covers the pilot for years. SOC 2 Type II compliance, modern React components that render cleanly at 375px, and built-in Hindi i18n. Vendor lock-in mitigated by storing only `clerk_user_id` (a single column) on `Owner` — every other foreign key in the DB references `Owner.id`, our internal ID.
- **See also:** §5 for the full multi-tenancy + JIT-sync design that hangs off this choice.

### 2.7 Compute: AWS Lambda + API Gateway via SST 🟡
- **What:** Backend deploys to Lambda behind API Gateway, infrastructure-as-code via [SST](https://sst.dev).
- **Why:** Scale-to-zero matches our usage profile; SST hides the CloudFormation boilerplate.
- **Justification:** Pilot traffic is tiny and bursty (mornings/evenings at the front desk). Lambda's per-request billing means literally cents/month at this scale. Only revisit if we need long-running processes (we don't yet).

### 2.8 Frontend host: Cloudflare Pages 🔒
- **What:** Static frontend deploys to Cloudflare Pages.
- **Why:** Unlimited bandwidth on the free tier; best PoP density in India.
- **Justification:** The public payment page (`/g/:slug`) is opened on patchy 4G by gym members — Indian PoP density matters more than build-dashboard polish. Cloudflare also becomes the registrar (§8.3) and DNS, so domain + CDN + frontend host live under one login. Vercel and Netlify both cap free bandwidth at 100 GB/mo, which becomes a real ceiling if Kasrat onboards 50 gyms.

### 2.9 File storage: S3 (ap-south-1) 🟡
- **What:** Reserved for v2 (gym photos/videos). Not used in v1.
- **Why:** AWS-native and cheap; ap-south-1 keeps the data close to users.
- **Justification:** Out of scope for v1 (§1.6). Reserved here so the choice doesn't have to be made under pressure later.

### 2.10 Email: AWS SES (deferred) 🟡
- **What:** Will be SES in ap-south-1 once we need transactional email. Not used in v1.
- **Why:** Clerk handles all auth-related email until v1.1.
- **Justification:** No code path in v1 sends email. SES is the cheapest option once we need it, and we're already in AWS for compute.

### 2.11 DNS / SSL: Cloudflare 🔒
- **What:** Cloudflare DNS (free) + automatic SSL via Cloudflare's edge.
- **Why:** Buying the domain on Cloudflare gives DNS + SSL for free with no setup.
- **Justification:** Route 53 + ACM costs more and requires more clicks. We're already using Cloudflare for the frontend.

### 2.12 Region: ap-south-1 (Mumbai) 🔒
- **What:** All AWS resources in Mumbai.
- **Why:** Lowest latency for Indian users.
- **Justification:** The whole user base is in India; no reason to sit data anywhere else.

### 2.13 Monorepo: single repo, npm workspaces 🔒
- **What:** One git repo with three packages (`shared`, `frontend`, `backend`) under `packages/*`, managed by npm workspaces.
- **Why:** Simpler than two repos for a solo builder; the shared TypeScript types are imported as `@gym-app/shared/types` from both ends.
- **Justification:** Two repos would mean publishing the shared types as a private npm package, version pinning, and PR coordination across repos — pure overhead. npm workspaces is good enough; we don't need pnpm/Turborepo until we're managing >5 packages.

### 2.14 IDE: Cursor (primary) + Claude Code CLI 🔒
- **What:** Day-to-day coding in Cursor; longer agentic tasks (refactors, scaffolds, multi-file builds) run via Claude Code CLI.
- **Why:** Cursor is the everyday driver; Claude Code is for jobs where you want a fresh context that can take 20–50 actions in a row.
- **Justification:** Tool decision, not product decision. Recorded so it's clear what assumed environment any future contributor walks into.

---

## 3. Data model

### 3.1 Six entities: Owner, Gym, Plan, Member, Membership, Payment 🔒
- **What:** The schema in [SPEC.md §4](SPEC.md). One owner has many gyms (schema-wise; one in v1). One gym has many members, plans, and memberships. One membership has many payments.
- **Why:** Mirrors how a gym actually thinks: members enroll in plans for a duration, and payments record one-shot transactions against those enrollments.
- **Justification:** Considered collapsing Membership into Member (one row per member with current plan inline) — would have made queued renewals impossible and would have lost payment history when plans changed.

### 3.2 Multi-tenant via `gym_id` foreign key 🔒
- **What:** Every tenant-scoped row carries a `gym_id` FK. Single Postgres database. No schema-per-tenant.
- **Why:** Simplest tenancy model that scales to thousands of gyms.
- **Justification:** Schema-per-tenant becomes operationally painful once you have >10 tenants (migrations, backups, connection pools). Database-per-tenant is even worse. A single FK column with discipline at the query layer is what Stripe, Linear, and Notion all do.

### 3.3 No partial payments 🔒
- **What:** Each renewal records exactly one Payment row for the full membership amount (which may be ₹0 for comps, but always exists).
- **Why:** Owners think in renewals, not installments. Modelling installments would add a `balance` column and a "fully paid" flag everywhere.
- **Justification:** If a member pays ₹1500 of a ₹2700 plan, the owner enters the next ₹1200 the next day as a fresh "renewal" of the same plan with `customPrice=1200`. Slightly hacky but matches what the owner already does on paper. Revisit if it becomes a real friction point in pilot.

### 3.4 Queued memberships allowed 🔒
- **What:** A member can have one current membership (`start <= today < end`) and zero or more future memberships (`start > today`). Future memberships auto-promote when the previous one ends.
- **Why:** Owners genuinely renew members early — "30 days left, but here's payment for the next 3 months."
- **Justification:** Without queuing, an early renewal would either reset the existing end date (loses 30 days of paid time) or stack onto it (data is wrong about *when* the new plan starts). Queuing is the only model that captures both.

### 3.5 Soft deletes everywhere 🔒
- **What:** `is_active` flag on Members and Plans. Never hard-delete.
- **Why:** Payment history must remain readable.
- **Justification:** A removed member's name appears on every Payment row. Hard-deleting makes those rows reference a missing entity; payment history collapses. Soft delete keeps reports honest.

### 3.6 Plans are templates 🔒
- **What:** Editing a Plan's price affects only future memberships. Existing memberships keep their original `amount_due` snapshot.
- **Why:** Owners change prices; existing members shouldn't be retroactively billed differently.
- **Justification:** Without a snapshot, raising a plan from ₹2700 to ₹3000 would suddenly make 50 active members "underpaid" on the dashboard. With a snapshot, the rule is simple: what you owe is what you signed up for.

### 3.7 "Member added without payment = Payment pending" 🔒
- **What:** Adding a member creates a Membership with `amount_paid = 0`. The member shows up in the Overdue section with a "Payment pending" badge instead of "X days overdue."
- **Why:** Distinguishes a brand-new member from one who lapsed.
- **Justification:** Both states share the same color (red) and the same urgency (collect money), but the language differs. "7 days overdue" implies the member is a problem; "Payment pending" implies the owner is.

### 3.8 Overdue = `end_date + grace < today` AND no queued plan 🔒
- **What:** A member is overdue only when their current plan has truly expired past the grace period AND they have no queued membership lined up.
- **Why:** Captures the actual real-world case where someone renewed early — they shouldn't show as overdue.
- **Justification:** Backend test `status.test.ts` enforces this: a queued membership prevents `overdue` even when the current one expired.

### 3.9 5-day grace period default, configurable per gym 🔒
- **What:** Default `gracePeriodDays = 5` on Gym. Editable in Settings.
- **Why:** Most owners won't bug a member the day their plan expires.
- **Justification:** 5 days is a guess from the pilot owner. The field is tunable, so other gyms can pick their own threshold.

### 3.10 `Owner.id` decoupled from `clerk_user_id` 🔒
- **What:** Internal IDs use the existing `owner-xxx` format. `clerk_user_id` is a separate UNIQUE column on Owner.
- **Why:** Auth-vendor portability.
- **Justification:** If we ever migrate from Clerk to Auth0 / Supabase / self-hosted, only `clerk_user_id` changes. Every FK elsewhere (`Gym.ownerId`, `Payment.recordedBy`, etc.) keeps working unchanged. One-column swap, not a schema-wide rewrite.

### 3.11 Date-only fields stored as `String` (`YYYY-MM-DD`) 🔒
- **What:** `joinDate`, `startDate`, `endDate`, `paidOn` are TypeScript `string` and SQL `TEXT` in `YYYY-MM-DD`.
- **Why:** SQLite has no `DATE` type, and the wire format we want is the same string anyway.
- **Justification:** Storing as `Date` would force timezone reasoning in three places (DB, server, client). `YYYY-MM-DD` interpreted as a local date avoids the entire UTC-shift class of bug. (We hit one of these bugs during Phase 6.1 — see §7.4.)

---

## 4. Build approach (mock-first)

### 4.1 Build the entire UI against a mock API layer first 🔒
- **What:** `mockApi.ts` and `mockData.ts` implement the same surface as the real backend. The frontend imports `api` from `lib/api.ts`, which switches based on `VITE_USE_REAL_API`.
- **Why:** Decouple frontend and backend timelines; build screens before the database exists.
- **Justification:** Without a mock layer we'd block on DB schema changes for every UI iteration. With it, the frontend was complete and clickable end-to-end before a single Prisma migration ran.

### 4.2 TypeScript types in `packages/shared` are the contract 🔒
- **What:** All API request/response shapes live in `packages/shared/src/types.ts`. Both `mockApi` and `realApi` (and the backend's serializer) import from here.
- **Why:** "Same shape" is enforced by the type checker, not by convention.
- **Justification:** When we build the real backend in Phase 7, the compiler complains the moment its response shape drifts from the contract the UI consumed against the mock. Zero shape drift, no integration surprises on day 1 of swapping mocks for reals.

### 4.3 Phased build (1 → 9), with each phase fully working before the next 🔒
- **What:** Phases were Product → Decisions → Data model → Tech → Wireframes → UI build with mocks → Backend → Wire to real API → Auth → Pilot.
- **Why:** Each phase has a verifiable end state; nothing is half-done across phases.
- **Justification:** We never had a multi-week "everything is broken" middle period. The frontend at the end of Phase 6 was a real, clickable product (with mocks). The backend at the end of Phase 7 was a real API (validated by tests). Swapping mock → real in Phase 8 was a single env var change.

### 4.4 Phase 6 build order: scaffold → types → mocks → routing → i18n → screens 🔒
- **What:** Inside Phase 6, the order was: monorepo scaffold (1) → `types.ts` (2) → `mockData/mockApi` (3) → `App.tsx` routing (4) → i18n bootstrap (5) → screens (6).
- **Why:** Each step is a strict prerequisite of the next; doing them in any other order means re-doing work.
- **Justification:** Building screens before mocks means the screens render hardcoded data and have to be rewritten when mocks land. Wiring routing before screens means each screen file just exports a stub component, and the navigation works while screens are filled in.

### 4.5 Each screen, when built, fully functional against mock 🔒
- **What:** "Done" for a Phase 6 screen means: clicking buttons triggers real state mutations in mock data, toasts appear, sort order updates, navigation works.
- **Why:** Catches UX bugs at the screen level, not at integration time.
- **Justification:** If clicking "+ Add member" only navigated to `/members/new` and the form didn't actually create anything, we'd find out only when the backend lands. Building each screen to a working state catches the "I forgot the form needs validation" bugs immediately.

---

## 5. Auth & multi-tenancy (Phase 8.5)

### 5.1 Clerk over Lucia, Auth.js, or roll-our-own 🔒
- **What:** Clerk is the auth provider for v1.
- **Why:** Lucia v3 was deprecated by its maintainer in March 2025 to a "learning resource"; Auth.js feels grafted-on for non-Next.js backends; rolling our own is multi-week work for a non-differentiating feature.
- **Justification:** Clerk gives 10k MAU free, SOC 2 Type II compliance, polished React components that look fine at 375px, built-in Hindi support, and ~5-minute setup. Vendor lock-in is mitigated by §3.10 (`Owner.id` decoupled from `clerk_user_id`).

### 5.2 Methods enabled day 1: Google OAuth (primary) + Email/Password (fallback) 🔒
- **What:** Both methods enabled in Clerk on day 1. Phone OTP, magic links, and MFA deferred to v1.1.
- **Why:** Most pilot owners have a Google account; some don't. Email/password covers the rest.
- **Justification:** Phone OTP requires an SMS provider integration; magic links need a working email-out path; MFA is overkill for "owner of one gym in Sagar." All three are one-toggle adds in Clerk's dashboard later — no code change needed.

### 5.3 JIT (just-in-time) user sync, not a Clerk webhook 🔒
- **What:** The Owner row in our DB is created lazily on the first authenticated request, not eagerly via a Clerk `user.created` webhook.
- **Why:** Removes operational complexity (no public webhook endpoint, no svix signature verification, no race conditions).
- **Justification:** A webhook means: deploy a public endpoint, verify signatures correctly, handle retries, handle out-of-order events, handle the case where the user creates a session before the webhook arrives. JIT is one upsert in the auth middleware: `prisma.owner.upsert({ where: { clerkUserId } })`. Self-healing — if the row goes missing, the next request recreates it. Since the owner edits gym info in our settings UI (not Clerk's), there's nothing to sync after the initial create.

### 5.4 Helper-function multi-tenancy, not Prisma extensions or Postgres RLS 🔒
- **What:** A `getOwnerGym(req)` helper returns the authenticated owner's gym. Every protected route filters explicitly: `prisma.member.findFirst({ where: { id, gymId: gym.id } })`.
- **Why:** Visible filters > magic.
- **Justification:**
  - **Prisma extensions** (e.g. middleware that auto-injects `gymId`) move the filter out of the route, making it easy to forget a route is protected.
  - **Postgres RLS** is the gold standard but: (1) SQLite (our dev DB) doesn't support it, breaking dev/prod parity; (2) it's deferred until we migrate to Neon, at which point we can layer it in as defense-in-depth without removing the helper-function checks.
  - The helper-function pattern means a code reviewer sees the `gymId` filter on every line that touches data — the security boundary is in the same file as the business logic.
- ID-based lookups must use `findFirst({ id, gymId })` not `findUnique({ id })` — the latter would let a user fetch any row by ID.

### 5.5 DB lookup per request, not a custom JWT claim 🔒
- **What:** On every authenticated request, the backend looks up the Owner row by `clerk_user_id`. We do not embed our internal `ownerId` as a custom Clerk JWT claim.
- **Why:** Security freshness > shaving 1ms.
- **Justification:**
  - **Stale-claim risk:** A custom JWT claim is set when the JWT is issued. If we soft-delete an owner, their existing JWT keeps working until expiry. With a per-request DB lookup, the next request immediately fails.
  - **Bootstrap problem:** The very first request after signup can't carry a custom claim (the owner row doesn't exist yet to be referenced). Solving this means a special bootstrap path. With JIT, the first request creates the row and looks it up in the same code path.
  - **Cost is negligible:** ~1ms for an indexed lookup on `clerk_user_id` (UNIQUE index). At 1000 req/s we'd reconsider; at our scale it's free.

### 5.6 `Owner` stores only mirror fields from Clerk 🔒
- **What:** `Owner` has `clerk_user_id`, `email`, `name`, `phone`. Password hashes, OAuth tokens, MFA secrets, sessions all live in Clerk.
- **Why:** Don't duplicate state we don't own.
- **Justification:** Mirroring the email and name once on creation gives us search and reporting capability without round-tripping to Clerk. Mirroring sessions or tokens would mean keeping them in sync — a class of bug we'd rather not have.

### 5.7 Public route stays open: `/public/gyms/:slug` 🔒
- **What:** Exactly one backend route is unauthenticated: `GET /public/gyms/:slug`.
- **Why:** Members scan the QR poster and need the gym info without a login.
- **Justification:** That endpoint returns only gym name, slug, address, timings, contact, UPI ID, and display name — no member data, no payment data. The auth bypass is intentional and audited.

### 5.8 Frontend uses `<RequireAuth>` + `<ClerkTokenBridge>` 🔒
- **What:** `RequireAuth` redirects to `/sign-in` when unauthenticated. `ClerkTokenBridge` sits under `<BrowserRouter>` and writes the current Clerk token into a module variable that `realApi.ts` reads on every request.
- **Why:** Clean separation: route guards say "can you access this page?"; the bridge says "what token to put on the request?"
- **Justification:** Without a bridge, every API call would have to call `useAuth().getToken()` itself — which only works inside React components (it's a hook). The bridge inverts that: React updates the token in one place, plain functions read it.

### 5.9 `NO_GYM` redirect to `/setup` 🔒
- **What:** When an authenticated owner has no Gym row yet, the backend returns 404 with `{ code: 'NO_GYM' }`. The frontend's `members-list` route catches this and redirects to `/setup`.
- **Why:** New users without a gym shouldn't see an empty members list — they should be funneled into setup.
- **Justification:** The alternative was a separate "do you have a gym?" call before every page load. Returning a structured error from the existing call is one round-trip, not two.

---

## 6. UI / UX conventions

### 6.1 Color-coded statuses with a fixed palette 🔒
- **What:** Overdue = `#FCEBEB` bg / `#791F1F` text. Expiring = `#FAEEDA` / `#633806`. Selected/info = `#E6F1FB` / `#185FA5` border / `#042C53` text. Neutral = gray.
- **Why:** Status is the most-glanced-at piece of data on the screen. Color is faster than text.
- **Justification:** Hex values are locked in `tailwind.config.ts` so designers and developers share the same names (`overdue.bg`, etc.). Picked to be legible at low brightness in fluorescent-lit gyms.

### 6.2 Sort order: overdue → payment_pending → expiring → active 🔒
- **What:** On the members list, overdue (most-overdue first), then payment-pending, then expiring (least-time first), then active (alphabetical).
- **Why:** Owners' attention should land on people they need to act on, in priority order.
- **Justification:** Pilot user said the first thing they want to see is "who owes me money." Active members are the long tail and don't need to be ranked by usefulness.

### 6.3 Mobile-first 375px target 🔒
- **What:** Every screen is designed at 375px first.
- **Why:** Phone is the primary input device.
- **Justification:** See §1.4. Carries through to every component decision: filter chips wrap, tile pickers stack vertically, no horizontal scroll, no hover-only states.

### 6.4 Bilingual i18n via `t('key')` from day 1 🔒
- **What:** No hardcoded user-facing strings anywhere. Every label, button, toast, error goes through `t()`.
- **Why:** See §1.5.
- **Justification:** Even when `hi.json` is empty, the `t()` calls work — they fall through to the key string. This means we can ship the English UI first, then translate without code changes.

### 6.5 Soft delete with a confirm dialog for destructive actions 🔒
- **What:** Removing a member opens a `<ConfirmDialog>` and, on confirm, soft-deletes (sets `isActive=false`).
- **Why:** Destructive actions deserve a deliberate click; soft delete preserves history (§3.5).
- **Justification:** Hard delete + no-confirm is two footguns at once. Either alone would be wrong.

### 6.6 DEV-only nav bar 🟡
- **What:** A small nav bar listing every route, rendered only when `import.meta.env.DEV` is true.
- **Why:** During Phase 6 we needed to jump between routes without state to build them in any order.
- **Justification:** It's free in prod (Vite's dead-code elimination drops it) and saves a lot of "how do I get to /settings without going through the hamburger" friction during dev.

### 6.7 Hamburger menu hosts language toggle 🔒
- **What:** EN/हिंदी toggle lives inside the top-bar hamburger menu (next to Plans / Settings / Logout).
- **Why:** Reachable from every screen, not just `/login` and `/g/:slug`.
- **Justification:** SPEC §6 originally only required it on those two screens, but during smoke testing we noticed an owner mid-flow couldn't switch languages. Putting it in the hamburger menu adds zero visual weight (it's hidden behind a click) and solves the access problem.

### 6.8 Slug-change confirm modal in Settings 🔒
- **What:** Editing the gym slug and clicking Save opens a confirm modal: "Changing this will invalidate any printed QR codes."
- **Why:** A printed QR code at the gym wall points to `/g/:slug`. Changing the slug bricks every poster.
- **Justification:** Inline warning text wasn't enough — it could be missed. A modal that requires a click to dismiss makes the consequence unignorable.

### 6.9 Members-list error UI with Retry 🔒
- **What:** If the initial `GET /members` fails (backend down), show a "Couldn't load members" panel with a Retry button.
- **Why:** "Loading…" spinning forever is a worse UX than an explicit error.
- **Justification:** Action writes (record payment, etc.) already toast on failure; the read path was missing the same treatment. Caught during Phase 6 testing when the dev backend was off.

---

## 7. Implementation details surfaced during the build

### 7.1 Sonner for toasts 🔒
- **What:** `sonner`'s `<Toaster position="bottom-center" />` mounted at App level.
- **Why:** Chosen over shadcn's `useToast` because Sonner is simpler and looks better at mobile widths.
- **Justification:** shadcn/ui's toast is fine but requires more boilerplate (provider, hook, dismiss-on-click logic). Sonner is one component and one function call.

### 7.2 `qrcode.react` for the UPI QR codes 🔒
- **What:** UPI QR codes generated client-side from `upi://pay?pa=…&pn=…&am=…&tn=…&cu=INR`.
- **Why:** Client-side generation means no server round-trip and no QR-image storage.
- **Justification:** UPI deep links are a documented spec; the QR is just an encoding of that string. Doing it on the server would mean an image endpoint, caching, and bandwidth — pointless for a string the client already has.

### 7.3 Vitest for unit tests on `computeStatus` 🔒
- **What:** 8 unit tests on `packages/backend/src/lib/status.ts`, using `vi.useFakeTimers()` + `vi.setSystemTime('2026-04-26')` for date stability.
- **Why:** Status computation is the highest-leverage logic in the app — get it wrong, the entire dashboard is wrong.
- **Justification:** Other code paths (CRUD endpoints, mutators) are mostly Prisma calls — testing them is testing Prisma. `computeStatus` has real branches (overdue / payment_pending / expiring / active / queued-prevents-overdue) and date arithmetic, which is exactly the class of code that breaks silently.

### 7.4 Local-date helpers in two places (frontend + backend) 🔒
- **What:** `iso()` and `parseDate()` use `getFullYear() / getMonth() / getDate()` (local components) instead of `toISOString().slice(0,10)` (UTC).
- **Why:** Prevent the off-by-one UTC bug we hit during Phase 6.1.
- **Justification:** During development at GMT-5 (CDT), `parseDate("2026-04-13")` parsed as UTC midnight, then `setHours(0,0,0,0)` shifted it back to April 12 in local time. Result: Rajesh showed "8 days overdue" instead of 7, Sneha "2 days left" instead of 3. The fix is to never round-trip a `YYYY-MM-DD` string through UTC.

### 7.5 Zod for backend request validation 🔒
- **What:** Every `POST` / `PATCH` request body is validated by a Zod schema before it hits Prisma.
- **Why:** Reject malformed input at the boundary, not in the middle of business logic.
- **Justification:** Without Zod, a missing `name` field would crash inside the Prisma call with a cryptic Prisma error. With Zod, it's a clean 400 with the field name in the message.

### 7.6 `setErrorHandler` reads `statusCode` off thrown errors 🔒
- **What:** `Object.assign(new Error(...), { statusCode: 404 })`; the global error handler maps to that status.
- **Why:** Throw, don't return, when something's wrong.
- **Justification:** Express's `next(err)` style is awkward in async/await. Throwing is the natural pattern; the error handler turns it into the right HTTP response.

### 7.7 Seed file uses `upsert` so re-runs are safe 🔒
- **What:** `prisma/seed.ts` is idempotent — running it twice produces the same DB state.
- **Why:** During development, you re-seed often.
- **Justification:** A non-idempotent seed would create duplicate gyms / members on every run, breaking the `slug` UNIQUE constraint. `upsert` keyed by stable IDs (`owner-anand-1`, `gym-gungun-1`) makes the seed both a fresh-install tool and a reset tool.

### 7.8 Both frontend and backend type-check independently 🔒
- **What:** `cd packages/frontend && npx tsc --noEmit` and `cd packages/backend && npx tsc --noEmit` both run clean.
- **Why:** Type errors should fail the build at the package that introduced them, not at integration time.
- **Justification:** Workspace-wide type-checking is possible but slow and conflates errors. Per-package keeps the feedback loop tight (~3s for frontend, ~2s for backend).

### 7.9 SQLite for dev, Postgres for prod, identical Prisma queries 🔒
- **What:** `provider = "sqlite"` in `schema.prisma` for dev; switch to `"postgresql"` for prod (one line).
- **Why:** SQLite needs no install; Postgres has features (RLS, JSONB, full-text) we'll grow into.
- **Justification:** Prisma abstracts both with the same query API. We do lose JSONB, partial indexes, and a few other Postgres-isms during dev — but the schema in v1 doesn't use any of them. When we adopt one, we adopt Postgres locally too.

### 7.10 CORS open in dev, lock down before prod 🟡
- **What:** `@fastify/cors` is set to `origin: true` (allow all). Documented in REPORT §7.3 to lock down before prod.
- **Why:** Don't fight CORS during dev.
- **Justification:** With separate Vite (5173) and Fastify (3001) ports, every dev request is cross-origin. `origin: true` is a deliberate dev-time trade-off, not laziness — but it's a pre-prod TODO.

---

## 8. Branding & domain

### 8.1 Name: Kasrat (कसरत) 🔒
- **What:** Product name is "Kasrat" — Hindi/Urdu for "workout."
- **Why:** Short, Sanskrit/Indic-rooted, casual word real users actually say at gyms.
- **Justification:** Considered: `vyayam` (more formal), `akhada` (wrestling-gym connotation, narrower vibe), `abhyas` (broader than exercise), `gada` / `pehlwan` (very desi-strongman, narrows the brand). `kasrat` has the friendliest, lowest-friction vibe — it's what a gym-goer's grandma calls going to the gym.

### 8.2 Pilot fixture: "Gungun Fitness Club" at slug `gungun` 🔒
- **What:** Seed and test data uses the family gym name.
- **Why:** Real names make demos and bug reports concrete.
- **Justification:** Using "Test Gym 1" risks shipping that string by accident. Real fixture names also force the i18n keys to be real (and not ASCII-clean), which catches a class of encoding bug early.

### 8.3 Domain on Cloudflare 🔒
- **What:** Buy `kasrat.in` on Cloudflare Registrar **before going live** (before the first physical QR poster is printed). Until then, dev and staging run on the free `kasrat.pages.dev` subdomain.
- **Why:** Cheapest registrar (no upsells), free DNS + SSL bundled, and we don't need a custom domain until something physical points at it.
- **Justification:** Cloudflare sells `.in` at cost (~₹500–600/year). Namecheap/GoDaddy are pricier and more friction. Frontend is on Cloudflare Pages — one dashboard, one set of credentials. The `pages.dev` URL works fine for owner-facing dev (HTTPS, India PoPs, previews per PR), so there's no reason to spend now. The hard deadline is the first printed poster: once a QR points at a URL, that URL must be the forever URL or every poster becomes garbage.

### 8.4 Repo renamed: `fitness-club` → `kasrat` 🔒
- **What:** GitHub repo and local folder both renamed.
- **Why:** Consistency with the brand once `Kasrat` was locked.
- **Justification:** GitHub auto-redirects the old URL for ~3 months, so external references aren't broken. Doing the rename now (small change, low risk) is cheaper than living with two names.

---

## 9. Repository, tooling & workflow

### 9.1 Single repo, npm workspaces 🔒
- **What:** Three packages under `packages/*`, managed via npm workspaces.
- **Why:** See §2.13.
- **Justification:** ditto.

### 9.2 `.gitignore` excludes worktrees, `.env`, `dev.db`, IDE files 🔒
- **What:** `.claude/worktrees/`, `.claude/settings.local.json`, `.env`, `dev.db`, `node_modules/`, `dist/`, `.idea/`, `.DS_Store` all ignored.
- **Why:** Don't leak secrets, machine-specific files, or build artifacts.
- **Justification:** Caught and re-fixed twice during the build (rsync-based session sync stomped `.gitignore`). The fix is permanent now; documented in REPORT §9.

### 9.3 `gh auth login` over PAT in chat 🔒
- **What:** Authenticate `git push` via the GitHub CLI's credential helper. Never paste PATs in chat.
- **Why:** PATs in chat are leaks, full stop.
- **Justification:** Once `gh auth setup-git` runs, the CLI's token is wired into git's credential helper — pushes Just Work, no token handling needed. We did the wrong thing once during the build (PAT pasted in chat → rotated immediately) and then put `gh` in place; that's the standing rule going forward.

### 9.4 `.env.example` committed, real `.env` ignored 🔒
- **What:** Both `packages/backend/.env.example` and `packages/frontend/.env.example` are tracked. The actual `.env` files are gitignored.
- **Why:** Document the variables without leaking values.
- **Justification:** Standard pattern. The example files include the variable names and short comments explaining what each is for.

### 9.5 REPORT.md as the handoff doc 🔒
- **What:** A long-form markdown file that explains layout, architecture, how to run, how to debug, how to deploy.
- **Why:** SPEC.md is the contract; REPORT.md is the operating manual.
- **Justification:** Without it, onboarding (or coming back to the project after weeks away) means re-deriving everything from code. With it, §5 ("How to run") gets you to a working dev env in ~5 minutes.

---

## 10. Pending decisions

The Phase 8.5 wrap-up flagged a queue of 9 still-open decisions. As of today:

| # | Question | Status | Default suggestion |
|---|---|---|---|
| 1 | Frontend host | 🔒 **Decided:** Cloudflare Pages | — |
| 2 | Backend host | 🔒 **Decided:** AWS Lambda + API Gateway via SST | — |
| 3 | Database | 🔒 **Decided:** Neon Postgres (prod) / SQLite (dev) | — |
| 4 | Auth | 🔒 **Decided:** Clerk | — |
| 5 | Repo rename | 🔒 **Done:** `fitness-club` → `kasrat` | — |
| 6 | CI/CD on PR / push to master | 🔒 **Decided:** GitHub Actions (typecheck + test + lint on PR) + Cloudflare Pages auto-preview; manual `sst deploy` for backend; manual `prisma migrate deploy` | — |
| 7 | Backups | 🔒 **Decided:** Neon's built-in PITR (7-day window on free tier); revisit at scale | — |
| 8 | Error tracking | 🔒 **Decided:** Sentry (free tier) on frontend only; AWS CloudWatch for backend logs. Layer Sentry onto backend later if traffic grows | — |
| 9 | Slug uniqueness check + reserved-slug list | 🔒 **Decided:** DB UNIQUE constraint + live availability check (`GET /public/slugs/check?slug=...`) + reserved list in `packages/shared` (see §11) | — |

All 9 questions resolved as of 2026-04-28.

---

## 11. Reserved slug list

Slugs that **cannot** be claimed as gym slugs. Lives in `packages/shared/src/reservedSlugs.ts` so frontend and backend share one source of truth.

### Format rules (enforced before checking the list)

- Lowercase letters, digits, and hyphens only (`/^[a-z0-9-]+$/`)
- 2–32 characters long
- Cannot start or end with `-`
- Cannot contain two consecutive `-`

### Reserved words

```
admin, api, auth, backup, billing, blog, contact, dashboard,
docs, faq, g, help, home, login, logout, members, new, payments,
plans, pricing, privacy, public, robots.txt, settings, setup,
sign-in, sign-up, sitemap.xml, status, support, terms, www
```

### Why each group is reserved

| Group | Why |
|---|---|
| `members`, `plans`, `settings`, `setup`, `login`, `logout`, `sign-in`, `sign-up`, `g`, `public`, `payments`, `new` | Existing app routes — claiming these would break routing |
| `admin`, `api`, `auth`, `backup`, `billing`, `dashboard`, `pricing`, `status`, `support` | Likely future routes — cheap to reserve now, painful to claw back later |
| `blog`, `contact`, `docs`, `faq`, `help`, `home`, `privacy`, `terms` | Marketing/legal pages we'll inevitably add |
| `robots.txt`, `sitemap.xml`, `www` | Conventional web paths that would collide with bots/crawlers |

When new app routes are added, append to this list in the same PR.

---

*Last updated 2026-04-28. Add new decisions at the bottom of the relevant section, with a short What / Why / Justification block.*
