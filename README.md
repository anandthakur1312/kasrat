# Kasrat (कसरत)

A bilingual (English / Hindi) gym-management web app for tiny Indian gyms — 50 to 150 members, single owner-operator. Mobile-first at ~375px; the owner runs it from a phone at the front desk. Members never log in — they scan a QR sticker on the wall to view a public page with gym info and a UPI QR for payment.

> **Pilot:** family-owned gym in Sagar, Madhya Pradesh.
> **Brand:** *Kasrat* is everyday Hindi/Urdu for "workout."

---

## Live URLs

| | |
| :-- | :-- |
| Frontend (production) | https://kasrat.pages.dev |
| Backend (Lambda Function URL) | https://lckqktk3eugpdfpdw75pty3nia0wfpfi.lambda-url.ap-south-1.on.aws |
| Public gym page (example, after seeding) | https://kasrat.pages.dev/g/gungun-anand |
| Source | https://github.com/anandthakur1312/kasrat |

Custom domain (`kasrat.in`) deferred until the first physical QR poster is printed — see [DECISIONS.md §8.3](./DECISIONS.md).

---

## Status

✅ Phases 1–8.6 done. The product is **deployed to production** and ready for pilot. Last open item: ⬜ Phase 9 — sit at the family gym in Sagar for a day, watch how it's actually used, fix what breaks.

Full phase list lives in [SPEC.md §3](./SPEC.md).

---

## Tech stack

| Layer | Choice |
| :---- | :---- |
| Frontend framework | [React 18](https://react.dev) + [Vite 5](https://vite.dev) + [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) primitives |
| Routing | [React Router](https://reactrouter.com) |
| i18n | [react-i18next](https://react.i18next.com) (en + hi from day 1) |
| Toasts | [Sonner](https://sonner.emilkowal.ski) |
| QR codes | [qrcode.react](https://github.com/zpao/qrcode.react) |
| Backend framework | [Node.js 20](https://nodejs.org) + [Fastify 5](https://fastify.io) + [TypeScript](https://www.typescriptlang.org) |
| ORM | [Prisma 5](https://www.prisma.io) |
| Validation | [Zod](https://zod.dev) |
| Tests | [Vitest](https://vitest.dev) |
| Database | [Neon](https://neon.tech) Serverless Postgres (`ap-southeast-1` Singapore) |
| Auth | [Clerk](https://clerk.com) — Google OAuth + Email/Password |
| Compute | [AWS Lambda](https://aws.amazon.com/lambda) Function URL via [SST](https://sst.dev) (`ap-south-1` Mumbai) |
| Frontend host | [Cloudflare Pages](https://pages.cloudflare.com) |
| DNS / SSL | [Cloudflare](https://www.cloudflare.com/dns) (free) |
| File storage (v2) | [Amazon S3](https://aws.amazon.com/s3) — reserved for photos/videos |
| Email (v1.1) | [AWS SES](https://aws.amazon.com/ses) — deferred |
| Monorepo | [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) |
| IaC | [SST 4](https://sst.dev) (Pulumi-based) |
| CI | [GitHub Actions](https://github.com/anandthakur1312/kasrat/actions) — typecheck + lint + Vitest on every PR |
| Error tracking | [Sentry](https://sentry.io) on frontend (planned), [AWS CloudWatch](https://aws.amazon.com/cloudwatch) on backend |

Full reasoning for each pick is in [DECISIONS.md](./DECISIONS.md).

### Dashboards (admin)

- **Neon**: https://console.neon.tech (project `kasrat`, region `ap-southeast-1`, branches `main` for prod and `dev` for local development)
- **Clerk**: https://dashboard.clerk.com (Kasrat app; Development instance — Production instance to be created when `kasrat.in` is wired)
- **AWS**: https://ap-south-1.console.aws.amazon.com (region `ap-south-1` Mumbai, Lambda function `kasrat-prod-ApiFunction-*`, CloudWatch logs `/aws/lambda/kasrat-prod-ApiFunction-*`)
- **Cloudflare**: https://dash.cloudflare.com (Pages project `kasrat`, registrar pending — see DECISIONS §8.3)

---

## Repository layout

```
kasrat/
├── README.md           ← this file (entry point)
├── SPEC.md             ← product specification (single source of truth)
├── REPORT.md           ← build & operations handoff (run, debug, deploy)
├── DECISIONS.md        ← every What/Why/Justification on the project
├── sst.config.ts       ← AWS infra (Lambda + Function URL)
├── .github/workflows/  ← CI
└── packages/
    ├── shared/         ← TypeScript types shared by frontend and backend
    │                     (the API contract — same shapes both sides)
    ├── frontend/       ← React + Vite SPA
    │   └── src/
    │       ├── routes/        ← one file per screen (members list, detail, …)
    │       ├── components/    ← shared UI (avatar, dialog, timings editor, …)
    │       ├── lib/           ← api switch, i18n, dates, mock layer
    │       └── locales/       ← en.json, hi.json
    └── backend/        ← Fastify on Lambda
        ├── prisma/
        │   ├── schema.prisma  ← single Postgres schema
        │   ├── migrations/    ← versioned, applied via `prisma migrate deploy`
        │   └── seed.ts        ← parameterized fixture loader
        └── src/
            ├── app.ts         ← Fastify builder (no listen)
            ├── server.ts      ← local-dev entrypoint (calls listen)
            ├── lambda.ts      ← Lambda handler (wraps app via @fastify/aws-lambda)
            └── lib/           ← auth, dates, status, ids, serialize
```

---

## Quickstart (local development)

Full instructions including Neon dev branch setup are in [REPORT.md §5](./REPORT.md). Compressed:

```bash
git clone https://github.com/anandthakur1312/kasrat.git
cd kasrat
npm install

# 1. Sign up at https://neon.tech, create a project in ap-southeast-1.
# 2. Create a `dev` branch off `main`, copy its pooled connection URL.
# 3. Sign up at https://dashboard.clerk.com, copy publishable + secret keys.
# 4. Configure env files:
cp packages/backend/.env.example  packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
# Paste DATABASE_URL + CLERK_SECRET_KEY into backend/.env;
# paste VITE_CLERK_PUBLISHABLE_KEY into frontend/.env.

# 5. Bootstrap (idempotent):
npm run setup:local

# 6. Run dev servers (two terminals):
npm run dev --workspace packages/backend       # Fastify on :3001
VITE_USE_REAL_API=1 npm run dev --workspace packages/frontend   # Vite on :5173
```

Open http://localhost:5173 → Clerk sign-up → `/setup` → fill gym → start adding members.

To run the frontend without a backend (mock mode), set `VITE_USE_REAL_API=` (empty) and skip the backend terminal.

---

## Architecture (1-screen summary)

```
┌─────────────────────────┐    HTTPS     ┌────────────────────────────┐
│  Cloudflare Pages       │─────────────▶│  AWS Lambda (ap-south-1)   │
│  React/Vite SPA         │   (CORS)     │  Fastify via               │
│  kasrat.pages.dev       │              │  @fastify/aws-lambda       │
│                         │              │  Function URL              │
│  Clerk publishable key  │              └────────────┬───────────────┘
└─────────┬───────────────┘                           │
          │                                           │ Prisma over libpq/SSL
          │ JWT in                                    ▼
          │ Authorization                ┌────────────────────────────┐
          │ header                       │  Neon Postgres             │
          ▼                              │  (ap-southeast-1)          │
┌─────────────────────────┐              │  branches: main + dev      │
│  Clerk (managed)        │              │  scales to zero            │
│  Google OAuth + email   │              └────────────────────────────┘
│  → JWT signed by Clerk  │
│  → backend verifies it  │
└─────────────────────────┘
```

Multi-tenancy: every protected route filters by `gymId`, which is read off `getOwnerGym(req)` after Clerk verifies the JWT and the backend looks up the matching `Owner` (created lazily on first authenticated request — JIT, no webhook). See [DECISIONS.md §5](./DECISIONS.md) for the full design.

---

## Documents

| File | What's in it |
| :--- | :--- |
| [SPEC.md](./SPEC.md) | The product spec — screens, data model, contracts, build order. Read this first if you're new. |
| [REPORT.md](./REPORT.md) | The operations manual — how to run locally, how to debug each layer, how to deploy, how to roll back. |
| [DECISIONS.md](./DECISIONS.md) | Every locked decision (What / Why / Justification) plus a few still-open items. |

---

## Out of scope for v1

Listed so it's clear what *isn't* missing — these are deliberate non-goals for the pilot:

- Photos / videos of the gym (S3 reserved, will land in v2)
- Member attendance / check-ins
- Payment reminders to members
- Trainer / staff sub-accounts
- Reports beyond what's visible on existing screens
- Phone + OTP login (Clerk feature flag, deferred to v1.1)
- Payment-gateway integration (Razorpay / Cashfree)
- Pricing / paid tiers — the pilot is fully free
