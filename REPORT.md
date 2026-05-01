# Kasrat — Build Report

A complete handoff document for Kasrat. Written so you can understand
what was built, why, where everything lives, how to run and rebuild it,
and how to debug each layer.

If you only read one section, read **§1 (TL;DR)** then **§5 (How to run)**.

---

## 1. TL;DR

- A bilingual (English/Hindi) gym-management web app for a tiny gym in
  Sagar, MP. Mobile-first (~375px). Full spec in [SPEC.md](./SPEC.md).
- npm-workspaces monorepo with three packages: `shared`, `frontend`, `backend`.
- Frontend: **[React 18](https://react.dev) + [Vite 5](https://vite.dev) + [Tailwind 3](https://tailwindcss.com) + [i18next](https://react.i18next.com)**. All 9 SPEC screens implemented.
- Backend: **[Fastify 5](https://fastify.io) + [Prisma 5](https://www.prisma.io) + [Zod](https://zod.dev)**, Postgres via [Neon](https://neon.tech) (dev branch locally, main in prod). Full REST API.
- The frontend can run **standalone** (uses an in-memory mock layer) or
  **against the real backend** by setting one env var. A 3-line switch
  in `src/lib/api.ts` chooses between them.
- Everything type-checks (`npx tsc --noEmit` clean in both packages),
  Vitest is green (8/8), and end-to-end works against a Neon dev branch
  locally and the Lambda deployment in production.

---

## 1.5 Live URLs and dashboards

**Production endpoints:**

| | |
| :-- | :-- |
| Frontend | https://kasrat.pages.dev |
| Backend (Lambda Function URL) | https://lckqktk3eugpdfpdw75pty3nia0wfpfi.lambda-url.ap-south-1.on.aws |
| Source repo | https://github.com/anandthakur1312/kasrat |
| CI runs | https://github.com/anandthakur1312/kasrat/actions |

**Admin dashboards** (you'll need to be logged in):

| | |
| :-- | :-- |
| Neon (Postgres — `ap-southeast-1`) | https://console.neon.tech |
| Clerk (Auth — Development instance) | https://dashboard.clerk.com |
| AWS Lambda (Mumbai) | https://ap-south-1.console.aws.amazon.com/lambda/home?region=ap-south-1 |
| AWS CloudWatch logs | https://ap-south-1.console.aws.amazon.com/cloudwatch/home?region=ap-south-1#logsV2:log-groups |
| Cloudflare Pages | https://dash.cloudflare.com |

**Quick health checks** from any terminal (no auth needed):

```bash
curl https://lckqktk3eugpdfpdw75pty3nia0wfpfi.lambda-url.ap-south-1.on.aws/health
# → {"ok":true}

curl -i https://lckqktk3eugpdfpdw75pty3nia0wfpfi.lambda-url.ap-south-1.on.aws/members
# → 401 {"error":"Unauthorized"}   ← Clerk gate is intact
```

A custom domain (`kasrat.in`) will replace `kasrat.pages.dev` before the
first physical QR poster is printed — see
[DECISIONS.md §8.3](./DECISIONS.md).

---

## 2. Repository layout

```
kasrat/
├── README.md                 # short quickstart
├── REPORT.md                 # this file
├── SPEC.md                   # source of truth — read this first
├── package.json              # root, npm workspaces config
├── package-lock.json
├── .gitignore
├── .claude/
│   └── launch.json           # Claude Code dev-server config (optional)
└── packages/
    ├── shared/               # TypeScript types, the API contract
    │   ├── package.json
    │   └── src/types.ts
    ├── frontend/             # React app (Vite)
    │   ├── package.json
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── tailwind.config.ts
    │   ├── postcss.config.js
    │   ├── tsconfig*.json
    │   ├── components.json   # shadcn/ui config
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx
    │       ├── index.css     # Tailwind base + shadcn CSS variables
    │       ├── lib/
    │       │   ├── api.ts          # the switch: mockApi or realApi
    │       │   ├── mockApi.ts      # in-memory implementation (offline)
    │       │   ├── realApi.ts      # fetch() against the Fastify backend
    │       │   ├── mockData.ts     # seed for the mock layer
    │       │   ├── format.ts       # date/currency formatting
    │       │   ├── i18n.ts         # i18next bootstrap
    │       │   └── utils.ts        # cn() helper
    │       ├── components/
    │       │   ├── avatar.tsx
    │       │   ├── confirm-dialog.tsx   # destructive-action modal
    │       │   └── language-toggle.tsx
    │       ├── locales/
    │       │   ├── en.json
    │       │   └── hi.json
    │       └── routes/             # one file per SPEC screen
    │           ├── members-list.tsx
    │           ├── member-detail.tsx
    │           ├── record-payment.tsx
    │           ├── add-member.tsx
    │           ├── edit-member.tsx       # /members/:id/edit
    │           ├── payment-history.tsx   # /members/:id/payments
    │           ├── plans.tsx
    │           ├── settings.tsx
    │           ├── auth.tsx
    │           ├── setup.tsx
    │           └── public-gym.tsx
    └── backend/              # Fastify API (Prisma + Postgres on Neon)
        ├── package.json
        ├── tsconfig.json
        ├── .env.example      # copy to .env to run locally
        ├── prisma/
        │   ├── schema.prisma
        │   ├── seed.ts
        │   └── migrations/
        │       └── 20260426125953_init/migration.sql
        └── src/
            ├── server.ts     # all routes, in one file
            ├── db.ts         # PrismaClient singleton
            └── lib/
                ├── dates.ts          # local-date helpers (avoid UTC bugs)
                ├── ids.ts            # short prefix-based IDs
                ├── serialize.ts      # Prisma → API shape
                ├── status.ts         # overdue/expiring/active logic
                └── status.test.ts    # Vitest tests for status.ts
```

---

## 3. Architecture overview

```
┌──────────────────────────┐       ┌─────────────────────────────┐
│ Frontend (Vite, :5173)   │       │ Backend (Fastify, :3001)    │
│                          │       │                             │
│  routes/*.tsx            │       │  server.ts (all routes)     │
│       │                  │       │       │                     │
│       ▼                  │       │       ▼                     │
│  src/lib/api.ts ─────────┼──fetch┼──▶ Zod parse                │
│   ├─ mockApi (default)   │  ▲    │       │                     │
│   └─ realApi (env=1)     │  │    │       ▼                     │
│       │                  │  │    │  Prisma client              │
│       ▼                  │  │    │       │                     │
│  in-memory mockState     │  │    │       ▼                     │
│  (mockData.ts)           │  │    │  Neon Postgres (dev branch) │
└──────────────────────────┘  │    └─────────────────────────────┘
                              │
            VITE_USE_REAL_API=1 toggles realApi
            VITE_API_URL overrides default http://localhost:3001
```

Both `mockApi` and `realApi` implement the **same set of methods** with
the **same argument and return types** (from `@gym-app/shared/types`).
The route components don't know which one they're talking to — they just
import `api` from `src/lib/api.ts`. This is why the swap was a one-line
switch: add `VITE_USE_REAL_API=1` to your env and the frontend reads
from your Neon dev branch via the backend.

---

## 4. Prerequisites

- **Node.js ≥ 20** (Vite 5 and Fastify 5 both want it).
- **npm ≥ 10** (workspaces).
- macOS / Linux. Should work on Windows via WSL.

```bash
node -v    # v20.x or newer
npm -v     # 10.x or newer
```

---

## 5. How to run — first time

Local dev points at a **Neon `dev` branch** so it shares the production
database engine (Postgres) without sharing production data. Branches in
Neon are git-like — copy-on-write off `main`, instant to create, free on
the free tier, idle-suspend the moment you stop using them.

```bash
# 1. Clone
git clone https://github.com/anandthakur1312/kasrat.git
cd kasrat

# 2. Install
npm install

# 3. Sign up at https://neon.tech (free).
#    - Create a project named "kasrat" in region ap-southeast-1 (Singapore)
#      or ap-south-1 (Mumbai) if your tier supports it.
#    - In the project, go to Branches → Create branch → name it "dev",
#      parent = "main", "Include data up to current state" (default).
#    - Open the dev branch → Connection details → copy the *pooled* URL
#      (the one with "-pooler" in the hostname).

# 4. Sign up for Clerk: https://dashboard.clerk.com → Create application.
#    - Name "Kasrat", enable Email + Google sign-in.
#    - From API Keys, copy:
#        VITE_CLERK_PUBLISHABLE_KEY (starts with pk_test_)
#        CLERK_SECRET_KEY           (starts with sk_test_)

# 5. Configure env files
cp packages/backend/.env.example  packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
#    - In packages/backend/.env paste DATABASE_URL = your Neon dev branch
#      pooled URL, and CLERK_SECRET_KEY.
#    - In packages/frontend/.env paste VITE_CLERK_PUBLISHABLE_KEY.

# 6. Bootstrap the local DB
npm run setup:local
#    Runs: install + prisma generate + prisma migrate deploy + db seed.
#    "migrate deploy" applies any committed migrations to your dev branch
#    without prompting; the seed uses upsert so re-running is idempotent.
```

The seed populates your Neon dev branch with one gym ("Gungun Fitness
Club", slug `gungun`), 4 plans, 3 members, 6 memberships, and 5 payments
— matching the SPEC §9 fixtures exactly.

The seed Owner has `clerkUserId: 'seed_user_anand'` which is *not* a
real Clerk user — the first time you sign in via Clerk and hit any
authed endpoint, a fresh Owner row gets JIT-created with your real
`clerkUserId`. The seed Gungun fixture is detached (its ownerId still
points at the seed Owner) and serves as a public-page demo at
`/g/gungun`. To make Gungun yours after signing up, either change
`Gym.ownerId` to your new owner's id, or just create a new gym via the
`/setup` flow.

### 5.0.1 Resetting your dev branch to a clean state

```bash
# Easiest path: in the Neon UI, "Reset from parent" on the dev branch.
# This resets the dev branch's data to whatever main currently has, in
# under a second. Then re-run `npm run db:seed --workspace packages/backend`
# if you want the SPEC §9 fixtures back.
```

### 5.1 Run frontend in mock mode (no backend needed)

```bash
# packages/frontend/.env should have VITE_USE_REAL_API empty (or removed)
npm run dev --workspace packages/frontend
# open http://localhost:5173
```

Mock mode still requires a Clerk publishable key (the app boots inside
`<ClerkProvider>` always), but you can sign in with any test email
through Clerk's dev UI and the mock layer takes over after that. State
is kept in memory and resets on every full page reload.

### 5.2 Run frontend against the real backend

In **two terminals**:

```bash
# Terminal 1 — backend
npm run dev --workspace packages/backend
# Fastify on http://localhost:3001
```

```bash
# Terminal 2 — frontend
VITE_USE_REAL_API=1 npm run dev --workspace packages/frontend
# open http://localhost:5173
```

The frontend now reads/writes via `fetch` to the Fastify backend, and
all writes persist to your Neon dev branch.

If your backend is on a different host, set `VITE_API_URL` in
`packages/frontend/.env` instead of inline.

### 5.2.1 First-time signup flow (with real backend)

1. Open http://localhost:5173 → redirected to `/sign-in`.
2. Click "Sign up", create an account with email or "Continue with Google".
3. After signup, Clerk redirects to `/setup`.
4. Fill in the gym details and click Create gym. The backend creates an
   `Owner` row (JIT, on the first authenticated request) and a `Gym`
   row owned by it.
5. Now `/` shows your members list (empty until you add some).

### 5.3 Build for production

```bash
# Frontend → static assets in packages/frontend/dist
npm run build --workspace packages/frontend

# Backend → compiled JS in packages/backend/dist
npm run build --workspace packages/backend
node packages/backend/dist/server.js
```

For a real deploy, set `DATABASE_URL` to the Neon `main` branch URL —
either via SST secrets (Lambda) or your platform's env var system.

---

## 6. Frontend in depth

### 6.1 Routing (`src/App.tsx`)

React Router v6 with these paths (matches SPEC §6):

| Path                       | Component                       |
| -------------------------- | ------------------------------- |
| `/`                        | `routes/members-list.tsx`       |
| `/members/:id`             | `routes/member-detail.tsx`      |
| `/members/:id/edit`        | `routes/edit-member.tsx`        |
| `/members/:id/pay`         | `routes/record-payment.tsx`     |
| `/members/:id/payments`    | `routes/payment-history.tsx`    |
| `/members/new`             | `routes/add-member.tsx`         |
| `/plans`                   | `routes/plans.tsx`              |
| `/settings`                | `routes/settings.tsx`           |
| `/login`                   | `routes/auth.tsx`               |
| `/setup`                   | `routes/setup.tsx`              |
| `/g/:slug`                 | `routes/public-gym.tsx`         |

Top-level `App.tsx` also wires:
- `<Toaster position="bottom-center" />` from `sonner` for toasts.
- A small **DEV nav bar** (only in `import.meta.env.DEV`) that lists
  links to every route — handy for jumping around without state.

**Member-detail menu wiring:** the ⋯ menu on `/members/:id` opens
**Edit** (→ `/members/:id/edit`) and **Remove**. Remove uses
`<ConfirmDialog>` — the destructive path requires a deliberate click.
Remove is a soft delete (`isActive=false`); the member's payment
history is preserved.

**Members-list error UI:** if the initial `GET /members` fails (e.g.
backend is down), the list shows a "Couldn't load members" panel with a
**Retry** button. Action writes (record payment, etc.) still toast on
failure as before.

**Settings slug-change confirm:** changing the `Public URL` field and
clicking Save opens a confirm modal explaining that printed QR codes
pointing to the old URL will stop working. Same `<ConfirmDialog>`
component as Remove.

**Hamburger menu:** EN/हिंदी language toggle now lives inside the
top-bar hamburger menu (alongside Plans / Settings / Logout) so it's
reachable from every screen, not just `/login` and `/g/:slug`.

### 6.2 The API switch — `src/lib/api.ts`

```ts
import { mockApi } from './mockApi';
import { realApi } from './realApi';
export const api = import.meta.env.VITE_USE_REAL_API === '1' ? realApi : mockApi;
```

Every route imports `api` and calls e.g. `api.getMembersList()`. To swap
implementations, set the env var and restart Vite — no code changes.

### 6.3 The mock layer — `src/lib/mockApi.ts` + `mockData.ts`

`mockData.ts` builds an in-memory state object (gym, plans, members,
memberships, payments) seeded the same way the backend is. `mockApi.ts`
exposes the same surface as `realApi` and mutates this state in place.
Each method does an `await delay(100)` so loading states feel real.

State **resets on full reload** — that's intentional, you can always
get back to a clean fixture by hitting Cmd-R.

### 6.4 The real adapter — `src/lib/realApi.ts`

A thin `fetch` wrapper. Each method maps to one endpoint:

| Method                    | HTTP                                        |
| ------------------------- | ------------------------------------------- |
| `getMembersList()`        | `GET  /members`                             |
| `getMemberDetail(id)`     | `GET  /members/:id`                         |
| `createMember(req)`       | `POST /members`                             |
| `updateMember(id, req)`   | `PATCH /members/:id`                        |
| `deleteMember(id)`        | `DELETE /members/:id`                       |
| `recordPayment(req)`      | `POST /payments`                            |
| `getPlans()`              | `GET  /plans`                               |
| `createPlan(req)`         | `POST /plans`                               |
| `updatePlan(id, req)`     | `PATCH /plans/:id`                          |
| `getGym()`                | `GET  /gym`                                 |
| `updateGym(req)`          | `PATCH /gym`                                |
| `createGym(req)`          | `POST /gyms`                                |
| `getPublicGym(slug)`      | `GET  /public/gyms/:slug`                   |

It throws on non-2xx so the existing `try { … } catch { toast.error(…) }`
blocks in screens still work.

### 6.5 i18n — `src/lib/i18n.ts`

`react-i18next` is initialized with `en` and `hi` resource bundles from
`src/locales/`. Pluralization keys use the standard `_one` / `_other`
suffixes. The `<LanguageToggle />` component switches between EN / हिंदी
and is currently rendered on `/login` and `/g/:slug`. Adding it to the
hamburger menu inside the app is a small follow-up.

### 6.6 Tailwind & design tokens

`tailwind.config.ts` defines:
- shadcn-style HSL CSS variables in `src/index.css` (background,
  foreground, primary, secondary, muted, accent, border, ring, etc.).
- SPEC §8 semantic palette baked in:
  - `overdue.bg` `#FCEBEB` / `overdue.text` `#791F1F`
  - `expiring.bg` `#FAEEDA` / `expiring.text` `#633806`
  - `info.bg` `#E6F1FB` / `info.text` `#042C53` / `info.border` `#185FA5`
- `darkMode: 'class'` (toggle is not yet wired but the variables exist).

### 6.7 The status logic

Found in `src/lib/mockApi.ts` (frontend mirror) and
`packages/backend/src/lib/status.ts` (the canonical version on the
server).

```text
payment_pending  → membership exists, amountPaid === 0
overdue          → today > endDate + gracePeriodDays  (and no queued plan)
expiring         → daysRemaining ≤ 7
active           → otherwise
```

Members list sort order: `overdue` (most-overdue first) →
`payment_pending` → `expiring` (least-time first) → `active` (alphabetical).

### 6.8 Local-date helpers (important — read before editing dates)

Vite/Node default to UTC for `toISOString()`. We saw a bug where Rajesh
showed "8 days overdue" instead of 7 and Sneha "2 days left" instead of
3 because `iso(new Date())` was UTC and `parseDate("2026-04-13")` parsed
as UTC midnight, then `setHours(0,0,0,0)` shifted it back to the prior
day in CDT.

The fix lives in **two** places — keep them in sync:

```ts
// packages/frontend/src/lib/mockData.ts
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// packages/backend/src/lib/dates.ts has the same pattern.
```

Date strings travelling between client and server are YYYY-MM-DD and
**always interpreted as local dates**.

---

## 7. Backend in depth

### 7.1 Stack

- **Fastify 5** for the HTTP server.
- **Prisma 5** for the database client + migrations.
- **Zod** for request body validation.
- **Postgres** via Neon, both locally (a `dev` branch) and in prod (the
  `main` branch). Branches are git-like: copy-on-write, instant to
  create, scale to zero when idle. Free tier covers everything we need.

### 7.2 Schema — `prisma/schema.prisma`

Six tables (one-to-many through the natural foreign keys):

```
Owner    1 ─ ∞ Gym
Gym      1 ─ ∞ Plan
Gym      1 ─ ∞ Member
Plan     1 ─ ∞ Membership
Member   1 ─ ∞ Membership
Membership 1 ─ ∞ Payment
```

Date-only fields are stored as `String` in `YYYY-MM-DD` format —
We want the wire format and the stored format to match (same string in
client → server → DB → server → client) so timezone arithmetic happens
in exactly one place.
Booleans, integers and timestamps use Prisma's native types.

### 7.3 Routes — `src/app.ts`

All in one file — short enough to skim in 5 minutes. Notable behavior:

- Protected routes use `getOwnerGym(req)` so every gym/member/plan lookup
  is scoped to the authenticated owner's gym.
- `POST /payments` mirrors SPEC §7.3:
  - future payment dates are rejected,
  - if there's an unpaid active or scheduled membership → attach the
    payment to it while preserving the selected coverage start date,
  - else if the member already has active or queued coverage → queue a
    renewal starting at the latest non-cancelled `endDate` (end dates
    are exclusive, so this keeps coverage continuous),
  - else → create a fresh membership starting on `paidOn`.
- `PATCH /plans/:id` only updates the plan; existing memberships keep
  the price they were created with (SPEC §7.6).
- `PATCH /members/:id` updates a member's name/phone (used by the
  edit-member screen).
- `DELETE /members/:id` is a **soft delete** — flips `isActive=false`.
  Memberships and payment history are preserved so reports stay
  accurate.
- `POST /gyms` is the first-time setup endpoint. It creates the gym and
  initial plans in one transaction, and returns `409 GYM_ALREADY_CONFIGURED`
  if the owner already has a gym.
- `GET /public/slugs/check` validates format, reserved words, and live
  availability for setup/settings.
- `GET /public/gyms/:slug` is the only unauthenticated endpoint — the
  public payment page. It returns *only* the public-safe fields.

CORS is wired through `packages/backend/src/lib/cors.ts`. Production
allows Kasrat's own domains, Cloudflare Pages previews for this project,
and any comma-separated origins in `CORS_ALLOWED_ORIGINS`; localhost is
allowed only outside `NODE_ENV=production`.

### 7.4 Error handling

`app.setErrorHandler` reads a `statusCode` property off thrown errors
(set with `Object.assign(new Error(...), { statusCode: 404 })`) and
falls back to 500. Validation errors from Zod throw a 400 with the
parser's message; the frontend's `try/catch` blocks toast on any
non-2xx.

### 7.5 Seed — `prisma/seed.ts`

Run with `npm run db:seed --workspace packages/backend`. It uses
`upsert` so re-running is safe. The fixture intentionally produces:

- 1 overdue member (Rajesh, last membership ended `today − 10`,
  grace = 3 ⇒ 7 days overdue).
- 1 expiring member (Sneha, ends `today + 3`).
- 1 active member (Anjali, ends `today + 42`).

If you change the date logic, this is the canary.

### 7.6 Tests — `src/lib/status.test.ts`

```bash
npm run test --workspace packages/backend
```

Vitest runs 8 unit tests covering `computeStatus`:

- payment_pending when there's no current membership
- payment_pending when current membership has `amountPaid=0`
- active when end date is well in the future
- expiring within the 7-day window
- overdue once past `endDate + gracePeriodDays`
- queued membership prevents `overdue` even when the current one expired
- queued membership prevents `expiring` even when within 7 days
- `amountDue` uses the *current* plan price when overdue, not the
  membership's frozen `amountDue`

Tests use `vi.useFakeTimers()` + `vi.setSystemTime('2026-04-26')` so
the assertions are stable regardless of the host clock.

---

## 8. End-to-end flow walkthroughs

### 8.1 "Owner records a UPI payment for an overdue member"

1. Owner taps Rajesh in the members list. → `GET /members/:id`.
2. Detail page shows `OVERDUE` red status card. Owner taps **Record payment**.
3. Pay screen pre-selects Rajesh's plan (3-Months, ₹2,700), method UPI.
   QR is generated client-side from `upi://pay?pa=…&pn=…&am=2700&tn=GYM-MEM-member-1&cu=INR`.
4. Member scans QR, owner confirms. → `POST /payments`.
5. Backend sees Rajesh has no active-and-unpaid membership and *no*
   currently-active membership (he's expired) → creates a new membership
   starting today. Inserts a Payment row referencing it.
6. Frontend toasts and navigates back. The list, when reloaded, no
   longer shows him in OVERDUE — he's now active with `daysRemaining ≈ 91`.

### 8.2 "Member visits the public page"

1. They scan a printed QR or open `/g/gungun`.
2. Frontend calls `GET /public/gyms/gungun`.
3. Backend returns gym name + city-derived line + UPI ID + display name
   + timings + address + phone (no member data).
4. Page renders a static UPI QR (no amount), the address as a Google
   Maps link, and the phone as a `tel:` link.

### 8.3 "First-time setup creates a gym"

1. Owner lands on `/setup`. Fills name, slug (auto-derived), public info,
   UPI ID, picks plans (defaults: 1/3/6/12 months at standard prices).
2. → `POST /gyms`. Backend upserts the gym row, replaces plans.
3. Frontend navigates to `/`. Members list is empty until they add some.

---

## 9. Debugging guide

### 9.0 Auth (Clerk) issues

**"Missing VITE_CLERK_PUBLISHABLE_KEY" thrown on app boot**
You haven't created `packages/frontend/.env`. Copy from `.env.example`
and paste your `pk_test_…` key from the Clerk dashboard.

**Backend returns 500 on every request**
Check `packages/backend/.env` has `CLERK_SECRET_KEY=sk_test_…`. The
backend logs `CLERK_SECRET_KEY is not configured` if it's missing.

**Backend returns 401 on every request even though I'm signed in**
Token isn't being attached. Open the browser network tab, look at the
request headers — `Authorization: Bearer eyJ…` should be there. If
not, `<ClerkTokenBridge />` isn't mounting (it's in `App.tsx` directly
under `<BrowserRouter>` — confirm it wasn't accidentally removed) or
Clerk hasn't finished hydrating yet (check console for Clerk errors).

**`/sign-in` shows but Google button does nothing**
You enabled email but not Google in your Clerk dashboard. Open the
Clerk dashboard → User & Authentication → Social Connections →
turn on Google.

**JIT Owner created but Gym fetch returns 404 with code: NO_GYM**
Expected for a brand-new owner — the frontend should redirect them to
`/setup`. If it doesn't, check `members-list.tsx` — the load() function
must catch `ApiError` and check `err.code === 'NO_GYM'`.

**Wrong owner sees Gungun's data**
Should never happen because every protected route filters by
`gym.id` from `getOwnerGym(req)`. If it does, look at the failing
route — chances are someone wrote `prisma.member.findUnique({ where: { id }})`
without the gymId scope. The pattern is always
`prisma.member.findFirst({ where: { id, gymId: gym.id }})`.

### 9.1 Frontend doesn't load

```bash
# Check Vite logs
# In Claude Code: preview_logs <serverId>
# Or look at the terminal where you ran `npm run dev`.

# Sanity:
curl -I http://localhost:5173
```

### 9.2 Frontend loads but shows "Loading…" forever

Means the `getMembersList` call hung or rejected. With the real API:

```bash
curl -i http://localhost:3001/health             # backend up?
curl -s http://localhost:3001/members | head -40 # what does it return?
```

If backend is down, restart it (`npm run dev --workspace packages/backend`).

If backend returns 500, check its terminal output — Fastify logs
every request and the full error trace.

### 9.3 Days-remaining looks wrong by one

You hit the UTC date bug. Check that **both** of these use local
date components:

- `packages/frontend/src/lib/mockData.ts` — `iso()` and `parseDate()`
- `packages/backend/src/lib/dates.ts` — `iso()` and `parseDate()`

Re-seed the backend (`npm run db:seed --workspace packages/backend`)
to confirm fixtures still produce the canary numbers (7 / 3 / 42).

### 9.4 Data desync between mock and real layer

They're independent. The mock layer always seeds the **same** initial
state from `mockData.ts`. The real layer's state is whatever's on your
Neon dev branch. Reset:

```bash
# Easiest: in the Neon UI, go to Branches → dev → "Reset from parent".
# Then re-seed:
npm run db:seed --workspace packages/backend
```

### 9.5 Inspect the DB directly

```bash
# psql (any libpq client works)
psql "$DATABASE_URL"
> \dt                              -- list tables
> SELECT * FROM "Member";          -- note the double-quotes; Prisma uses
                                   -- mixed-case table names which Postgres
                                   -- treats as case-sensitive identifiers
> SELECT * FROM "Membership" WHERE "memberId" = 'member-1';
```

Or use Prisma Studio:

```bash
npx prisma studio --schema packages/backend/prisma/schema.prisma
```

### 9.6 Frontend type errors

```bash
cd packages/frontend && npx tsc --noEmit
```

The shared package is referenced as `@gym-app/shared/types` — if you
change a type there, both packages pick it up automatically.

### 9.7 Backend type errors

```bash
cd packages/backend && npx tsc --noEmit
```

If Prisma types are stale (after editing `schema.prisma`):

```bash
npm run prisma:generate --workspace packages/backend
```

### 9.8 Hindi translation missing for some key

The frontend will fall back to the key string itself if a translation
is missing. Fix by adding the key to **both** `en.json` and `hi.json`
under the same nested path. Plural keys must use the `_one` / `_other`
suffix (i18next standard).

### 9.9 CORS errors in the browser

CORS is owned by Fastify, not the Lambda Function URL layer. The allowlist
lives in `packages/backend/src/lib/cors.ts`:

- production allows `https://kasrat.pages.dev`, `https://*.kasrat.pages.dev`,
  `https://kasrat.in`, `https://www.kasrat.in`, plus any exact origins in
  `CORS_ALLOWED_ORIGINS`;
- local development allows localhost/loopback origins only when
  `NODE_ENV !== "production"`.

If the browser reports a CORS failure, first check the request `Origin`
header against that allowlist and confirm the deployed Lambda has the
expected `CORS_ALLOWED_ORIGINS` value. Preflight `OPTIONS` should return
204 from Fastify.

---

## 10. What's deliberately NOT done

These were out of scope for the pilot or deferred to a later phase.
Listed so you don't think they were missed:

- **End-to-end tests.** Vitest covers backend policy/helpers, but there
  are no Playwright / browser tests yet.
- **PWA / offline / push.** No service worker, no manifest, no favicon.
- **Dark mode toggle.** CSS variables are wired, no toggle UI yet.
- **Custom domain + production Clerk instance.** The app is live on
  `kasrat.pages.dev`; `kasrat.in` and Clerk Production keys are deferred
  until the first physical QR poster is ready.

---

## 11. Deploying to production

The locked architecture (see [DECISIONS.md](./DECISIONS.md)):

- **Frontend** → Cloudflare Pages
- **Backend** → AWS Lambda Function URL via SST, ap-south-1 (Mumbai)
- **Database** → Neon Postgres (ap-southeast-1 Singapore — Mumbai isn't on Neon free tier yet)
- **Auth** → Clerk (production keys)

### 11.1 One-time setup (you do this once per fresh laptop)

```bash
# 1. Install AWS CLI and configure with an IAM user that has admin on a
#    fresh AWS account (we'll narrow permissions later).
brew install awscli                                # mac
aws configure                                       # paste access key + secret
aws sts get-caller-identity                         # confirms creds work

# 2. Sign up at neon.tech (free), create a project named "kasrat" in
#    region "AWS / ap-southeast-1 (Singapore)". Copy the pooled connection
#    URL of the *main* branch — that's the production DB. Then create a
#    second branch named "dev" (Branches → Create branch → off main); its
#    URL goes in your local packages/backend/.env.

# 3. Sign up / log in at cloudflare.com. Note the Account ID from the
#    sidebar of any zone or the dashboard home page.
```

### 11.2 Deploy the backend (Lambda)

```bash
# Set secrets once per stage. Stored in AWS Systems Manager Parameter Store.
npx sst secret set DatabaseUrl    "$NEON_DATABASE_URL"   --stage prod
npx sst secret set ClerkSecretKey "$CLERK_SECRET_KEY"    --stage prod

# Run pending migrations against Neon (one-shot, before/after deploys).
DATABASE_URL="$NEON_DATABASE_URL" \
  npx prisma migrate deploy --schema packages/backend/prisma/schema.prisma

# Provision Lambda + Function URL + IAM in ap-south-1.
npm run deploy

# SST prints the Lambda Function URL (something like
# https://<id>.lambda-url.ap-south-1.on.aws). Copy it for the frontend env.
```

### 11.3 Deploy the frontend (Cloudflare Pages)

In the Cloudflare dashboard:

1. Workers & Pages → Create → Pages → Connect to Git → pick the `kasrat` repo.
2. Build configuration:
   - Build command: `npm run build --workspace packages/frontend`
   - Build output directory: `packages/frontend/dist`
   - Root directory: leave blank (we build from repo root)
3. Environment variables (Production):
   - `VITE_USE_REAL_API=1`
   - `VITE_API_URL=<Lambda Function URL from §11.2>`
   - `VITE_CLERK_PUBLISHABLE_KEY=<pk_live_...>`
4. Save & Deploy.

Cloudflare auto-builds on every push to `master` and creates preview URLs
for every PR.

### 11.4 First-time signup against the deployed stack

1. Open `https://kasrat.pages.dev` (or `https://kasrat.in` once the
   custom domain is wired — see [DECISIONS.md §8.3](./DECISIONS.md)).
2. Sign up via Clerk → redirected to `/setup`.
3. Fill in gym details → `POST /gyms` JIT-creates the Owner row in Neon
   and creates the Gym + Plans.
4. Land on `/` → empty members list.

### 11.5 Re-deploys

```bash
# After a backend code change:
npm run deploy

# After a backend schema change:
DATABASE_URL="$NEON_DATABASE_URL" \
  npx prisma migrate deploy --schema packages/backend/prisma/schema.prisma
npm run deploy

# After a frontend change:
git push origin master   # Cloudflare auto-deploys
```

### 11.6 Tearing down a non-prod stage

```bash
npx sst remove --stage <stage>
```

`prod` stage is configured with `removal: "retain"` so this command will
not destroy production resources even if pointed at it.

---

## 12. Changing things — common recipes

### 12.1 Add a new screen

1. Create `packages/frontend/src/routes/foo.tsx`.
2. Register it in `src/App.tsx`'s `<Routes>`.
3. Add i18n keys to `src/locales/en.json` and `src/locales/hi.json`.
4. If it talks to the backend, add a method to **both** `mockApi.ts`
   and `realApi.ts` (and a route in `packages/backend/src/server.ts`).
5. Add the type to `packages/shared/src/types.ts` if it's a new shape.

### 12.2 Add a new field to the Member model

1. Edit `packages/backend/prisma/schema.prisma`.
2. `npm run prisma:migrate --workspace packages/backend` (creates a
   new migration).
3. Update `packages/backend/src/lib/serialize.ts` if needed.
4. Update `packages/shared/src/types.ts` Member type.
5. Update `packages/frontend/src/lib/mockData.ts` to seed it in mock state.

### 12.3 Tweak status thresholds (e.g. "expiring" window)

`EXPIRING_THRESHOLD_DAYS` in `packages/frontend/src/lib/mockApi.ts`
**and** in `packages/backend/src/lib/status.ts`. Keep them in sync.

The grace period is per-gym in the DB (`Gym.gracePeriodDays`, default
3). Edit on the Settings screen.

### 12.4 Re-seed the DB from scratch

```bash
# In Neon UI: Branches → dev → "Reset from parent" (instant, no data loss
# beyond your local dev branch).
npm run prisma:deploy --workspace packages/backend
npm run db:seed       --workspace packages/backend
```

---

## 13. Reference: every npm script

### Root (`package.json`)

```bash
npm install                    # installs all workspaces
npm run dev                    # alias → frontend dev (mock mode)
npm run build                  # alias → frontend build
npm run lint                   # alias → frontend lint
```

### Frontend (`packages/frontend/package.json`)

```bash
npm run dev      --workspace packages/frontend   # Vite dev server
npm run build    --workspace packages/frontend   # production build
npm run preview  --workspace packages/frontend   # preview the build
```

Env vars:
- `VITE_USE_REAL_API=1` — use the Fastify backend instead of mocks.
- `VITE_API_URL=…`     — override the backend URL (default `http://localhost:3001`).

### Backend (`packages/backend/package.json`)

```bash
npm run dev              --workspace packages/backend   # tsx watch src/server.ts
npm run build            --workspace packages/backend   # tsc → dist/
npm run start            --workspace packages/backend   # node dist/server.js
npm run prisma:generate  --workspace packages/backend   # regen Prisma client
npm run prisma:migrate   --workspace packages/backend   # create new migration (dev)
npm run prisma:deploy    --workspace packages/backend   # apply pending migrations
npm run db:push          --workspace packages/backend   # sync schema (no migration)
npm run db:seed          --workspace packages/backend   # seed fixtures
npm run test             --workspace packages/backend   # vitest run
```

Env vars (`packages/backend/.env`, copy from `.env.example`):
- `DATABASE_URL` — Neon Postgres pooled URL for your `dev` branch.
- `PORT`         — Fastify port (default `3001`).
- `CLERK_SECRET_KEY` — Clerk dev/test secret key (sk_test_…).
