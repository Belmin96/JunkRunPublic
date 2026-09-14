# JunkRun — Curb it. We'll serve it.

> **This copy is in demo mode** — real Clerk auth is mocked so it runs with
> zero setup. See [`DEMO.md`](./DEMO.md) before reading the "What's real vs.
> what needs your keys" section below, which describes the *non-demo* state.

A two-sided junk removal marketplace: customers post a job with a photo, contractors browse the **HaulBoard** and send estimates, the customer picks one, and payment is held until the job is verified done.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router (TypeScript), built as an installable PWA |
| Auth | Clerk (Google OAuth + Phone/SMS OTP) |
| Database | SQLite via Prisma ORM (swap to Postgres for production — see below) |
| Payments | Stripe (SetupIntent for card verification, PaymentIntents with manual capture, Connect for payouts) |
| Notifications | Web Push (VAPID, self-hosted — no 3rd-party push vendor) + in-app notification center |
| UI | Tailwind CSS |

---

## What's real vs. what needs your keys

This runs out of the box against a local SQLite database with seed data — you can click through every screen immediately. Three things need your own credentials before they're fully live:

1. **Clerk auth** — `.env.local` ships with a syntactically-valid placeholder key so the app builds and the public pages render, but Clerk safely 404s any protected route until you drop in a real publishable/secret key pair.
2. **Stripe** — job posting, browsing, and estimates all work with no Stripe keys. The moment a customer verifies a card (`/customer/payment`) or accepts an estimate (which charges the saved card), you need real **test-mode** Stripe keys.
3. **Camera capture** — before/after photos use `<input capture="environment">`, which opens the device camera directly on mobile browsers (Chrome/Safari on Android & iOS) instead of the photo library. This is the strongest "camera-only" guarantee a web app can give — a determined user on desktop Chrome can still pick a file, since there's no OS-level lockout outside a native app build.
4. **Push notifications** — real Web Push is wired up with a generated VAPID key pair (already in `.env.local` for local dev). Once a user taps "Enable alerts" and grants permission, they get real OS-level notifications — this **does** work today, no extra service needed. For it to reach a phone as an actual "app," the user should use "Add to Home Screen" so it runs as an installed PWA.

---

## Local Setup

### 1. Prerequisites
- Node.js 20+

### 2. Install
```bash
npm install --legacy-peer-deps
```
(`--legacy-peer-deps` works around a peer-dependency range mismatch between this Next.js version and the latest Clerk SDK — harmless.)

### 3. Configure environment
`.env` holds `DATABASE_URL` (read by the Prisma CLI). `.env.local` holds everything else (read by Next.js). Both already exist with working defaults — edit `.env.local` to drop in real Clerk/Stripe keys when you have them. To generate your own Web Push keys:
```bash
npm run vapid:generate
```

### 4. Database
```bash
npm run db:push   # create/sync the SQLite schema
npm run db:seed   # demo data: 1 owner, 1 verified customer, 2 contractors (one verified, one pending), 4 jobs in different stages
```
Seeded logins use fake Clerk IDs, so they're for browsing DB state (`npm run db:studio`) rather than signing in — real sign-in requires real Clerk keys and creates its own users via the `/api/webhooks/clerk` webhook.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000.

---

## Switching to Postgres for production

Edit `prisma/schema.prisma`'s datasource to:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
SQLite doesn't support native enums, so every status/role/type field here is a plain `String` with the allowed values documented in `lib/constants.ts` — that still works fine on Postgres, no schema changes needed beyond the provider line. Point `DATABASE_URL` at a hosted Postgres (e.g. [Neon](https://neon.tech)) and run `npx prisma db push`.

---

## The flow

```
Customer posts job (photo + questionnaire) → HaulBoard notifies contractors
  → Contractors estimate or pass → Customer accepts one estimate (card charged as a hold)
  → Contractor starts job → Contractor captures after photo → job enters 24h dispute window
  → Admin (or auto after window) releases payment → 90% to contractor, 10% to JunkRun
```

- **Job posting questionnaire**: job type(s) (Furniture / Appliances / Construction Debris / Yard Waste / Mattresses / Electronics), what to expect, how many stories, a required before photo, address, and either a set time or "Anytime that day."
- **Evidence checklist**: before photo comes from the **customer** at posting time; after photo comes from the **contractor** at completion. Payment only releases once both exist.
- **Auto-return**: if an assigned job isn't completed within 24h of its scheduled pickup, it's automatically unassigned, its card hold released, and it reappears on the HaulBoard for new estimates (`/api/cron/auto-return`, wired to run every 30 min via `vercel.json`; trigger manually from `/admin/finance`).
- **Reviews**: customers and contractors each rate the other after a completed job. On the **customer's own profile**, reviews from contractors are shown without attribution — no name tells them which contractor left which review. Contractor profiles show the reviewer's name normally.
- **Verification**: a customer can't post a job until they've verified a payment method (`/customer/payment`, backed by a Stripe SetupIntent). A contractor's "Verified Pro" badge comes from an admin approving their uploaded insurance doc (`/admin/verification`).
- **Finance**: JunkRun's 10% platform fee and each contractor's 90% payout are tracked as separate running totals (`/admin/finance`), with a weekly rollup (`WeeklyPayout`) generated by `/api/cron/weekly-payout-summary` (Mondays via `vercel.json`, or manually).
- **Receipts**: printable receipts for both sides at `/customer/jobs/[id]/receipt` and `/hauler/jobs/[id]/receipt` (browser print-to-PDF).

---

## Roles

| Role | Home | Access |
|---|---|---|
| `CUSTOMER` | `/customer/dashboard` | Post jobs, review estimates, pay, dispute, review contractors |
| `HAULER` | `/hauler/loads` | Browse the HaulBoard, estimate or pass, complete jobs, manage insurance & alerts |
| `ADMIN` | `/admin/ops` | Ops dashboard, All Loads, Verification queue, Finance, dispute resolution |
| `OWNER` | same as `ADMIN` | Full access |

Roles live in Clerk's `publicMetadata.role` (uppercase — `CUSTOMER` / `HAULER` / `ADMIN` / `OWNER`) and sync to the DB via the Clerk webhook. Promote a user to `ADMIN`/`OWNER` from the Clerk dashboard.

---

## Deploying (Vercel)

1. Push to GitHub, import in Vercel.
2. Switch to Postgres (see above) — Vercel's serverless functions can't share a SQLite file.
3. Add every var from `.env.example` in Vercel project settings, including a real `CRON_SECRET` (Vercel Cron sends it automatically as `Authorization: Bearer $CRON_SECRET` when the env var is named exactly that).
4. `vercel.json` already schedules `/api/cron/auto-return` (every 30 min) and `/api/cron/weekly-payout-summary` (Mondays).
5. Point Clerk's and Stripe's webhook URLs at your production domain.

---

## Known dependency advisory

`npm audit` flags a `postcss` vulnerability bundled *inside* Next.js's own build tooling (dev/build-time only, not shipped to the browser). It clears once you're willing to take Next.js 16 (a breaking major bump) — left as-is for now since it doesn't affect the running app.
