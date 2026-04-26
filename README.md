# Gym App

Bilingual (English/Hindi) responsive web app for tiny Indian gym owners. See [SPEC.md](./SPEC.md) for the full project specification — it is the single source of truth.

## Quickstart

```bash
npm install
npm run dev
```

Frontend dev server runs at http://localhost:5173.

## Structure

- `packages/shared` — TypeScript types shared between frontend and backend (the API contract).
- `packages/frontend` — React + Vite + Tailwind + shadcn/ui app.
- `packages/backend` — Fastify + Prisma API (Phase 7, not yet built).
