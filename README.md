# Kasrat

Bilingual (English/Hindi) gym-management SaaS for small Indian gyms. Mobile-first, ~₹67/month infra target. See [SPEC.md](./SPEC.md) for the full design and [REPORT.md](./REPORT.md) for the build handoff.

## Quickstart

```bash
# Install everything
npm install

# Set up the backend's local SQLite DB
cp packages/backend/.env.example packages/backend/.env
npm run prisma:generate --workspace packages/backend
npm run prisma:migrate  --workspace packages/backend
npm run db:seed         --workspace packages/backend

# Run frontend in mock mode (no backend needed)
npm run dev --workspace packages/frontend
# → http://localhost:5173

# Or run with the real backend (two terminals):
npm run dev --workspace packages/backend
VITE_USE_REAL_API=1 npm run dev --workspace packages/frontend
```

## Structure

- `packages/shared` — TypeScript types shared between frontend and backend (the API contract).
- `packages/frontend` — React 18 + Vite 5 + Tailwind 3 + i18next + shadcn-style components.
- `packages/backend` — Fastify 5 + Prisma 5 + Zod, SQLite for local dev.

Full repo layout, architecture, debugging guide, and deploy notes are in [REPORT.md](./REPORT.md).
