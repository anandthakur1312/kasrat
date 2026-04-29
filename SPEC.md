# Kasrat — Project Specification

**Single source of truth for this project.** Read this in full at the start of every coding session. When in doubt, this document wins over memory or assumptions.

---

## 1\. Product

A bilingual (English/Hindi) responsive web app for tiny Indian gym owners (50–150 members, single owner-operator). The owner replaces pen-and-paper tracking of members, plans, and payments. Members never log in — they scan a QR stuck on the gym wall to view a public page with gym info and a UPI QR for payment.

**Pilot:** family-owned gym in Sagar, Madhya Pradesh.

**Mobile-first.** Owner uses this on a phone at the front desk; designed for \~375px width, scales up for desktop.

**Out of scope for v1:**

- Photos/videos of the gym  
- Member attendance / check-ins  
- Payment reminders to members  
- Trainer / staff sub-accounts  
- Reports beyond what's visible on existing screens  
- Member profile fields beyond name \+ phone  
- Phone \+ OTP login (deferred to v1.1)  
- Payment gateway integration (Razorpay/Cashfree)  
- Pricing / paid tiers — fully free during pilot

---

## 2\. Tech stack (locked)

| Layer | Choice |
| :---- | :---- |
| Frontend | [React](https://react.dev) \+ [Vite](https://vite.dev) \+ [TypeScript](https://www.typescriptlang.org) \+ [Tailwind CSS](https://tailwindcss.com) \+ [shadcn/ui](https://ui.shadcn.com) |
| Routing | [React Router](https://reactrouter.com) |
| i18n | [react-i18next](https://react.i18next.com) (set up from day 1\) |
| Backend | [Node.js](https://nodejs.org) \+ [TypeScript](https://www.typescriptlang.org) \+ [Fastify](https://fastify.io) \+ [Prisma](https://www.prisma.io) |
| Database | Postgres on [Neon](https://neon.tech) (serverless, scales to zero) — `ap-southeast-1` Singapore (Mumbai not on free tier) |
| Auth | [Clerk](https://clerk.com) (managed) — Google OAuth (primary) \+ Email/Password (fallback) |
| Compute | [AWS Lambda](https://aws.amazon.com/lambda) \+ [API Gateway](https://aws.amazon.com/api-gateway) via [SST](https://sst.dev) |
| Frontend hosting | [Cloudflare Pages](https://pages.cloudflare.com) |
| File storage | [Amazon S3](https://aws.amazon.com/s3) (ap-south-1) — for v2 photos/videos |
| Email | [AWS SES](https://aws.amazon.com/ses) — deferred until v1.1 |
| DNS / SSL | [Cloudflare](https://www.cloudflare.com/dns) (free) |
| Region | `ap-south-1` (Mumbai) for compute, `ap-southeast-1` (Singapore) for DB |
| Monorepo | Single repo, [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) |
| IDE | [Cursor](https://cursor.com) (primary) \+ [Claude Code](https://claude.com/claude-code) CLI (agentic tasks) |

---

## 3\. Build phases (current status)

✅ Phase 1: Product definition ✅ Phase 2: Critical flow decisions ✅ Phase 3: Data model ✅ Phase 4: Tech stack ✅ Phase 5: UI wireframes (all 8 screens) ✅ Phase 6: UI build with mocked data ✅ Phase 7: Backend foundation \+ API spine ✅ Phase 8: Wire UI to real APIs ✅ Phase 8.5: Real auth (Clerk) \+ multi-tenancy ✅ Phase 8.6: Production deploy (Lambda \+ Neon \+ Cloudflare Pages) 🔵 **Phase 9: Pre-launch pilot at family's gym in Sagar ← we are here**

**The plan:** build the entire UI against a mock API layer first. The mock layer obeys TypeScript types derived from the real schema, so when the backend is built later, the real API conforms to the same contract. Zero shape drift.

---

## 4\. Data model

Multi-tenant via `gym_id` foreign key on every tenant-scoped row. Single Postgres database, no schema-per-tenant.

### Entities

Owner (the person who logs in)

  \- id

  \- clerk\_user\_id           UNIQUE; foreign key to Clerk's user record

  \- email                   UNIQUE; mirrored from Clerk for migration safety

  \- name                    mirrored from Clerk on JIT creation

  \- phone                   nullable, for v1.1 OTP

  \- created\_at

  Note: password hashes, OAuth tokens, MFA secrets, and sessions are managed entirely by Clerk. The DB stores only the minimal reference fields needed by business logic. Migrating to a different auth provider in the future is a one-column swap on this table — every foreign key elsewhere (`Gym.ownerId`, `Payment.recordedBy`, etc.) keeps working unchanged.

Gym (one per owner for v1; schema allows multiple later)

  \- id

  \- owner\_id → Owner

  \- name                        e.g. "Gungun Fitness Club"

  \- slug                        e.g. "gungun", used in /g/:slug

  \- address                     multi-line text

  \- timings                     free text — supports split batches

  \- contact\_phone

  \- upi\_id                      e.g. "owner@okaxis"

  \- upi\_display\_name            shown when member pays

  \- grace\_period\_days           default 5; configurable per gym

  \- created\_at

Plan (membership plan templates per gym)

  \- id

  \- gym\_id → Gym

  \- duration\_months             1, 3, 6, 12 (or any int)

  \- price                       ₹, owner-set

  \- name                        auto: "1 Month" / "3 Months", or override

  \- is\_active                   soft delete; archived plans hidden from picker

  \- created\_at

Member

  \- id

  \- gym\_id → Gym

  \- name

  \- phone

  \- join\_date

  \- is\_active                   soft delete

  \- created\_at

Membership (a member's plan enrollment, current or queued)

  \- id

  \- member\_id → Member

  \- plan\_id → Plan

  \- start\_date

  \- end\_date                    computed and stored: start\_date \+ plan.duration\_months

  \- amount\_due                  snapshot of plan.price at enrollment

  \- amount\_paid                 running total

  \- custom\_price                nullable; if owner adjusted from plan default

  \- status                      active / expired / cancelled

  \- created\_at

Payment

  \- id

  \- membership\_id → Membership

  \- amount

  \- method                      cash / upi / other

  \- paid\_on                     date

  \- reference\_note              e.g. "GYM-MEM-042" for UPI; blank for cash

  \- recorded\_by → Owner

  \- created\_at

### Key invariants

1. **No partial payments.** Each renewal records one Payment row for the full amount (which may be ₹0 for comps, but always exists).  
2. **Queued memberships allowed.** A member may have one "current" membership (start\_date ≤ today \< end\_date) and zero or more "future" memberships (start\_date \> today). Future memberships auto-promote to current when the previous one ends.  
3. **Soft deletes everywhere.** Members, plans never hard-delete; flip `is_active = false`. Preserves payment history.  
4. **Plans are templates.** Editing a plan's price affects only future memberships. Existing memberships keep their original `amount_due` snapshot.  
5. **Member added without payment \= "Payment pending"** — appears in Overdue section with badge "Payment pending" instead of "X days overdue."  
6. **Overdue calculation:** member is overdue if current membership has `end_date + grace_period_days < today` AND there is no active queued membership. New members added today are immediately overdue (Payment pending) until first payment.

---

## 5\. TypeScript types (the contract)

These types are the contract between frontend and backend. Mock layer obeys them now; real API obeys them later. Define in `packages/shared/types.ts`.

// Domain entities

export type PaymentMethod \= 'cash' | 'upi' | 'other';

export type MembershipStatus \= 'active' | 'expired' | 'cancelled';

export type MemberStatus \= 'overdue' | 'expiring' | 'active' | 'payment\_pending';

export interface Owner {

  id: string;

  name: string;

  email: string | null;

  phone: string | null;

  createdAt: string; // ISO 8601

}

export interface Gym {

  id: string;

  name: string;

  slug: string;

  address: string;

  timings: string;

  contactPhone: string;

  upiId: string;

  upiDisplayName: string;

  gracePeriodDays: number;

  createdAt: string;

}

export interface Plan {

  id: string;

  gymId: string;

  durationMonths: number;

  price: number;

  name: string;

  isActive: boolean;

  memberCount?: number; // hydrated for plans list view

  createdAt: string;

}

export interface Member {

  id: string;

  gymId: string;

  name: string;

  phone: string;

  joinDate: string;

  isActive: boolean;

  createdAt: string;

}

export interface Membership {

  id: string;

  memberId: string;

  planId: string;

  startDate: string;

  endDate: string;

  amountDue: number;

  amountPaid: number;

  customPrice: number | null;

  status: MembershipStatus;

  createdAt: string;

}

export interface Payment {

  id: string;

  membershipId: string;

  amount: number;

  method: PaymentMethod;

  paidOn: string;

  referenceNote: string;

  recordedBy: string; // Owner.id

  recordedByName: string; // hydrated

  createdAt: string;

}

// API response shapes

export interface MemberListItem {

  member: Member;

  currentMembership: Membership | null;

  plan: Plan | null; // plan of currentMembership

  status: MemberStatus;

  daysOverdue: number | null;     // when status \= 'overdue'

  daysRemaining: number | null;   // when status \= 'expiring' or 'active'

  amountDue: number | null;       // when status \= 'overdue' or 'payment\_pending'

}

export interface MembersListResponse {

  members: MemberListItem\[\];

  counts: {

    all: number;

    overdue: number;     // includes payment\_pending

    expiring: number;

    active: number;

  };

}

export interface MemberDetailResponse {

  member: Member;

  currentMembership: Membership | null;

  queuedMemberships: Membership\[\];

  plan: Plan | null;

  status: MemberStatus;

  daysOverdue: number | null;

  daysRemaining: number | null;

  amountDue: number | null;

  paymentHistory: Array\<Payment & {

    planName: string; // plan name at time of payment

  }\>;

}

export interface PublicGymResponse {

  gym: Pick\<Gym, 'name' | 'slug' | 'address' | 'timings' | 'contactPhone' | 'upiId' | 'upiDisplayName'\>;

}

// Request shapes

export interface CreateGymRequest {

  name: string;

  slug: string;

  address: string;

  timings: string;

  contactPhone: string;

  upiId: string;

  plans: Array\<{ durationMonths: number; price: number }\>;

}

export interface CreateMemberRequest {

  name: string;

  phone: string;

  planId: string;

  startDate: string; // defaults to today on the frontend

}

export interface RecordPaymentRequest {

  memberId: string;

  planId: string;

  amount: number;

  method: PaymentMethod;

  paidOn: string;

}

export interface UpdateGymRequest {

  name?: string;

  slug?: string;

  address?: string;

  timings?: string;

  contactPhone?: string;

  upiId?: string;

  upiDisplayName?: string;

  gracePeriodDays?: number;

}

export interface CreatePlanRequest {

  durationMonths: number;

  price: number;

  name?: string;

}

export interface UpdatePlanRequest {

  price?: number;

  name?: string;

  isActive?: boolean;

}

---

## 6\. Routing

/                       Members list (if logged in) or redirect to /login

/login                  Auth screen (Google \+ email/password)

/setup                  First-time gym setup (after first login, if no gym yet)

/members/new            Add member

/members/:id            Member detail

/members/:id/pay        Record payment

/plans                  Plans list (with inline editing)

/settings               Gym settings

/g/:slug                Public gym page (no auth required)

---

## 7\. Screen specifications

All 8 screens are designed and locked. Below is the spec for each. Mobile-first, \~375px width target. Use shadcn/ui components.

### 7.1 Members list (`/`) — landing screen

**Layout (top to bottom):**

- Top bar: gym name in 11px uppercase \+ "Members" title in 15px/500. Hamburger icon on right.  
- Search input: "Search by name or phone"  
- Filter chips: All · N | Overdue · N | Expiring · N | Active · N. Selected chip is solid black.  
- Section: "Overdue" header (red uppercase label, secondary background)  
  - Member rows with red avatar, status: "12 days overdue" or "Payment pending"  
- Section: "Expiring soon" header (amber)  
  - Member rows with amber avatar, "X days left"  
- Section: "Active" header (gray)  
  - Member rows with gray avatar, "X days left"  
- Bottom: full-width black "+ Add member" button

**Sort order:** overdue (most overdue first) → payment pending → expiring soon (least time first) → active (alphabetical).

**Row contents:** initials avatar (color-coded), name, plan, status text, amount due (overdue only).

**Tap a row** → `/members/:id`. **Hamburger** → menu with Plans, Settings, Logout.

### 7.2 Member detail (`/members/:id`)

**Layout:**

- Top bar: back arrow, "Member" title, "⋯" menu (Edit / Remove)  
- Identity block: 56px avatar, name, phone, "Joined DD MMM YYYY"  
- Status card (full-width, color-coded by status):  
  - Overdue: red bg, "OVERDUE 12 days", current plan name, expired date, amount due  
  - Active: neutral bg, "ACTIVE", days remaining, plan name, end date  
  - Payment pending: red bg, "PAYMENT PENDING", plan name, amount due  
- Primary button (full-width black): **"Record payment"**  
- Section: "Payment history" header \+ "View all" link  
  - Last 5 payments. Each row: plan name, "DD MMM YYYY · METHOD · by \[recorder\]", amount

**Tap "Record payment"** → `/members/:id/pay`.

### 7.3 Record payment (`/members/:id/pay`)

**Layout:**

- Top bar: back arrow, "Renew membership" title  
- Member context strip: avatar, name, phone  
- Plan picker: 4 tiles vertically (1mo / 3mo / 6mo / 12mo). Selected tile has 2px blue border \+ light blue bg.  
- Amount \+ Date row (both editable, side by side)  
- Payment method picker: 3 tiles horizontally (UPI / Cash / Other). Selected has blue border \+ bg.  
- **If method \= UPI:** inline QR card appears below method picker.  
  - Label: "Show to member"  
  - QR code (180px, generated from `upi://pay?pa={upiId}&pn={displayName}&am={amount}&tn={refNote}`)  
  - "₹{amount} to {displayName}"  
  - "Ref: GYM-MEM-{memberId}"  
- Bottom button: "Confirm payment received" (UPI/Other) or "Confirm cash received" (Cash)

**On confirm:** POST `/payments` (creates Payment \+ Membership in one transaction) → toast "Payment recorded ✓" → navigate back to `/members/:id`.

**Membership creation logic:**

- If member has no current membership OR current is overdue: new membership becomes current, starts on `paidOn`.  
- If member has active current membership: new membership is queued, starts on `currentMembership.endDate + 1 day`.

### 7.4 Add member (`/members/new`)

**Layout (4 fields, 1 button):**

- Top bar: back arrow, "Add member" title  
- Name input (required)  
- Phone input (required)  
- Plan picker (same tiles as Record Payment, 1 selected by default \= the cheapest plan? or first plan? — pick a sensible default)  
- Start date input (defaults to today, editable)  
- Bottom button: "Add member"

**On submit:** POST `/members` (creates Member \+ Membership with `amount_due` set, `amount_paid` \= 0\) → toast "Rajesh Kumar added" → navigate to `/`.

The new member appears at the top of Overdue section with badge "Payment pending."

### 7.5 Public gym page (`/g/:slug`) — no auth

**Layout:**

- Top right: language toggle (EN / हिंदी) as pills  
- Centered: gym name (22px/500), city subtitle (12px uppercase tertiary)  
- QR card (secondary bg, lg radius, padded):  
  - Label "Pay your fees"  
  - 180px QR (static UPI, no amount)  
  - "Scan with any UPI app"  
  - "PhonePe · Google Pay · Paytm · BHIM"  
- 3 info cards (Timings / Address / Contact):  
  - Each: 18px icon, uppercase label, value  
  - Phone is `<a href="tel:...">` (blue)  
  - Address is `<a href="https://maps.google.com/?q=...">` (opens maps)

### 7.6 Plans (`/plans`)

**Layout:**

- Top bar: back arrow, "Plans" title  
- Helper text: "Tap a price to edit. Changes apply only to new memberships — existing members keep their original price."  
- List of plan rows. Each row:  
  - Plan name (e.g. "1 month")  
  - Member count subtitle (e.g. "Used by 12 members")  
  - Editable price chip (₹ \+ number input)  
  - "⋯" menu (Archive)  
- Bottom: dashed-border "+ Add new plan" button

**On price change (blur):** PATCH `/plans/:id` with new price. **On Archive:** PATCH `/plans/:id` with `isActive: false`. **Add new plan:** opens an inline form (duration \+ price \+ Save) at the bottom.

### 7.7 Gym settings (`/settings`)

**Sections:**

- **Identity:** Gym name input | Public URL (with `kasrat.in/g/` prefix). Slug edits trigger amber warning: "Changing this will invalidate any printed QR codes."  
- **Public info:** Address textarea | Timings input (free text, supports split batches) | Contact phone input  
- **Payments:** UPI ID input | Display name on QR input  
- **Overdue:** Grace period (number input \+ "days" suffix)  
- **View public page:** link/button that opens `/g/:slug` in new tab  
- Bottom button: "Save changes" — saves all sections at once

### 7.8 Auth (`/login`)

**Layout:**

- Top right: EN / हिंदी toggle  
- Centered logo placeholder (48px black square with "G")  
- Heading: "Continue to your gym"  
- Subtitle: "Sign in or create your gym account"  
- "Continue with Google" button (white bg, black text, Google logo SVG)  
- "OR" divider  
- Email input  
- Password input  
- Two buttons side-by-side: "Log in" (filled black) | "Create account" (outlined)  
- Footer: "By continuing, you agree to the terms of service."

**On successful auth:**

- If owner has no gym yet → `/setup`  
- If owner has gym → `/`

### 7.9 First-time gym setup (`/setup`)

**Layout:**

- Header: "Welcome → Set up your gym → Just the basics, you can change anything later."  
- **Your gym:** Gym name | Public URL (slug auto-generates from name as user types; editable)  
- **Public info:** Address textarea | Timings | Contact phone  
- **Payments:** UPI ID  
- **Plans you offer:** counter "N selected"  
  - Helper: "Tap a plan to include it. Tap the price to edit."  
  - 4 plan tiles, all selected by default (1mo/3mo/6mo/12mo with example prices ₹1000 / ₹2700 / ₹5000 / ₹9000)  
  - Selected tile: 2px blue border, light blue bg, "Selected" pill, blue price chip  
  - Unselected: neutral border, muted text, gray price chip  
  - Tap card body → toggle selection. Tap price chip → edit price.  
- Bottom button: "Create gym" (disabled if no plans selected)

**On submit:** POST `/gyms` (creates Gym \+ selected Plans) → navigate to `/`.

---

## 8\. Design system

- **Mobile-first.** Design at 375px, scale up.  
- **Tailwind CSS** for all styling. **shadcn/ui** components (copied into `frontend/src/components/ui/`).  
- **Colors:**  
  - Overdue/danger: `#FCEBEB` bg, `#791F1F` text  
  - Expiring/warning: `#FAEEDA` bg, `#633806` text  
  - Selected/info: `#E6F1FB` bg, `#185FA5` border, `#042C53` text  
  - Neutral: gray  
- **Avatars:** initials in colored circle. Color matches member status.  
- **Section headers:** 11px uppercase, letter-spacing 0.5px, font-weight 500, secondary background strip.  
- **Form fields:** 11px uppercase labels above inputs. Standard shadcn input height.  
- **Primary buttons:** full-width black bg, white text, 12px padding, medium font weight.  
- **Secondary buttons:** transparent bg, black text, 0.5px secondary border.  
- **Cards:** white bg, 0.5px tertiary border, lg radius (12px).  
- **Bilingual:** every user-facing string goes through `t('key')` from day 1\.

---

## 9\. Mock data shape

`frontend/src/lib/mockData.ts` — minimal data, just enough to render every screen.

**Contents:**

- 1 Owner: "Anand Sharma" — [anand@example.com](mailto:anand@example.com)  
- 1 Gym: "Gungun Fitness Club" — slug `gungun`, UPI `sagargym@okaxis`, grace 5 days  
- 4 Plans: 1mo/3mo/6mo/12mo at ₹1000/₹2700/₹5000/₹9000, all active  
- 3 Members covering all states:  
  - **Rajesh Kumar** — 3-month plan, expired 12 days ago \+ 5-day grace \= OVERDUE 7 days, ₹2,700 due, 4 historical payments  
  - **Sneha Patel** — 6-month plan, expires in 3 days \= EXPIRING, no amount due  
  - **Anjali Singh** — 3-month plan, 42 days remaining \= ACTIVE, no amount due  
- 5 Payments across the 3 members

`frontend/src/lib/mockApi.ts` exports an object with the same method signatures the real API will have:

export const mockApi \= {

  async getMembersList(): Promise\<MembersListResponse\> { ... },

  async getMemberDetail(id: string): Promise\<MemberDetailResponse\> { ... },

  async createMember(req: CreateMemberRequest): Promise\<Member\> { ... },

  async recordPayment(req: RecordPaymentRequest): Promise\<Payment\> { ... },

  async getPlans(): Promise\<Plan\[\]\> { ... },

  async updatePlan(id: string, req: UpdatePlanRequest): Promise\<Plan\> { ... },

  async createPlan(req: CreatePlanRequest): Promise\<Plan\> { ... },

  async getGym(): Promise\<Gym\> { ... },

  async updateGym(req: UpdateGymRequest): Promise\<Gym\> { ... },

  async getPublicGym(slug: string): Promise\<PublicGymResponse\> { ... },

  async createGym(req: CreateGymRequest): Promise\<Gym\> { ... },

};

All methods simulate \~100ms latency with `await new Promise(r => setTimeout(r, 100))` to make loading states realistic.

When the real backend exists, swap `mockApi` for `realApi` in one place. UI is untouched.

---

## 10\. Repo structure

gym-app/

├── SPEC.md                  ← this document

├── README.md                ← short pointer to SPEC.md \+ quickstart

├── package.json             ← workspaces config

├── packages/

│   ├── shared/

│   │   ├── package.json

│   │   └── src/

│   │       └── types.ts     ← single source of truth for API contracts

│   ├── frontend/

│   │   ├── package.json

│   │   ├── vite.config.ts

│   │   ├── tailwind.config.ts

│   │   ├── index.html

│   │   └── src/

│   │       ├── main.tsx

│   │       ├── App.tsx

│   │       ├── routes/

│   │       │   ├── members-list.tsx

│   │       │   ├── member-detail.tsx

│   │       │   ├── record-payment.tsx

│   │       │   ├── add-member.tsx

│   │       │   ├── plans.tsx

│   │       │   ├── settings.tsx

│   │       │   ├── auth.tsx

│   │       │   ├── setup.tsx

│   │       │   └── public-gym.tsx

│   │       ├── components/

│   │       │   ├── ui/           ← shadcn components

│   │       │   └── (custom shared components)

│   │       ├── lib/

│   │       │   ├── mockData.ts

│   │       │   ├── mockApi.ts

│   │       │   └── i18n.ts

│   │       └── locales/

│   │           ├── en.json

│   │           └── hi.json

│   └── backend/             ← built in Phase 7

│       └── (empty for now)

└── .gitignore

---

## 11\. Phase 6 build order (UI with mocks)

Build in this order so each step yields a clickable thing:

1. **Scaffold the monorepo:** workspaces, frontend Vite app, shared types package, Tailwind, shadcn/ui init, react-router, react-i18next  
2. **Define `types.ts` in `packages/shared`** — exact contents from §5  
3. **Create `mockData.ts` and `mockApi.ts`** — exact contents from §9  
4. **Set up routing** — exact paths from §6  
5. **Set up i18n** — `en.json` filled, `hi.json` empty for now (stubs)  
6. **Build screens in this order:**  
   1. Members list (`/`)  
   2. Member detail (`/members/:id`)  
   3. Record payment (`/members/:id/pay`)  
   4. Add member (`/members/new`)  
   5. Public gym page (`/g/:slug`)  
   6. Plans (`/plans`)  
   7. Settings (`/settings`)  
   8. Auth (`/login`)  
   9. First-time setup (`/setup`)  
7. **Click through end-to-end** at family's gym in Sagar. Feedback. Iterate.  
8. **Fill in `hi.json`** with Hindi translations once strings are stable.

Each screen, when built, should be fully functional against the mock API — clicking buttons triggers real state updates in mock data. The mock layer is mutable for the session (refresh resets) so the user can experience real flows.

---

## 12\. Decisions log (key calls \+ reasoning)

- **Web app, not native.** Faster to ship, no app store, mobile-friendly via responsive design.  
- **Members never log in.** Public page via QR. Halves the scope of auth, avoids dual app builds.  
- **Clerk over Lucia/Auth.js for auth.** Lucia v3 was deprecated to a "learning resource" by its maintainer (Mar 2025); Auth.js feels grafted-on for non-Next backends. Clerk gives 10k MAU free tier, SOC 2 Type II, modern React components that render cleanly at 375px, built-in Hindi i18n, and 5-min setup. Vendor lock-in is mitigated by keeping Owner records in our Postgres so business data stays portable.  
- **Google OAuth (primary) \+ Email/Password (fallback).** Both enabled in Clerk on day 1\. Phone OTP, magic links, and MFA deferred to v1.1 — all are one-toggle adds in Clerk's dashboard, no code change needed. Email verification and password reset are handled automatically by Clerk.  
- **JIT (just-in-time) user sync over webhook.** Owner row is lazy-created on first authenticated request. No webhook endpoint to expose, no svix signatures, no race conditions, self-healing. Since owners edit gym info in our settings UI (not Clerk's), there's nothing to sync after the initial create.  
- **Helper-function multi-tenancy, not Prisma extensions or RLS.** `getOwnerGym(req)` returns the authenticated owner's gym; every protected route filters by `gym.id` explicitly. Visible filters \> magic. ID-based lookups use `findFirst({ id, gymId })` to prevent cross-tenant leaks. Postgres RLS deferred until production migration to Neon (SQLite doesn't support it).  
- **DB lookup per request, not custom JWT claim.** Backend looks up Owner by `clerk_user_id` on every request (\~1ms indexed query). A custom JWT claim would skip the lookup but introduces stale-claim risk (a soft-deleted owner could keep working until JWT expires) and bootstrap complexity (the first request after signup can't carry the claim yet). Trade 1ms for security freshness.  
- **`Owner.id` decoupled from `clerk_user_id`.** Internal IDs use the existing `owner-xxx` format; `clerk_user_id` is a separate UNIQUE column. If we ever migrate from Clerk to Auth0/Supabase/etc., only the `clerk_user_id` column changes — every other foreign key stays valid.  
- **Plan-based memberships, not open-ended.** Cleaner data model, automatic overdue detection.  
- **Per-plan pricing.** No discount engine — owner just sets price per plan. Edit `amount_due` on individual memberships if a discount is needed for one member.  
- **No partial payments.** One Payment row per renewal, full amount.  
- **Queued memberships.** A member with 40 days left who renews queues the new membership to start on day 41\.  
- **UPI option B: dynamic QR with member ID in note field.** Owner reconciles manually but `GYM-MEM-042` makes it instant.  
- **Cash \+ Other payment methods supported.** \~30-50% of Indian gym payments are cash.  
- **Add member ≠ pay first.** Owner adds member with start date today; member shows "Payment pending" until first payment.  
- **5-day grace period default**, configurable per gym.  
- **Soft deletes.** Never hard-delete members or plans — payment history depends on them.  
- **Single repo, npm workspaces.** Simpler than 2 repos for solo builder.  
- **Cloudflare Pages over CloudFront.** Cheaper, faster, simpler deploy for a static frontend.  
- **Neon over RDS.** Scales to zero, free tier covers pilot indefinitely.  
- **Hindi from day 1\.** Sagar is Hindi-belt; bilingual is non-negotiable; retrofitting i18n later is painful.

---

## 13\. What's next after Phase 6

Phase 7: build backend. The contract is already defined in `packages/shared/types.ts`. Backend implements endpoints that conform to it. UI swaps `mockApi` for `realApi` in one place.

Phase 8: deploy to AWS via SST. First deploy is the riskiest moment — schedule a focused session for it.

Phase 9: pilot at family's gym in Sagar. Sit at the front desk for a day before launch. Watch how it's actually used. Fix what breaks.

---

*End of spec. When uncertain, re-read this. When this conflicts with memory, this wins.*  
