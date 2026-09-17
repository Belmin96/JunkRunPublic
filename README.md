# JunkRun — Curb it. We'll serve it.

> **Demo mode:** Clerk can be mocked for local browsing. See `DEMO.md` for the demo/non-demo boundary.

A two-sided junk-removal marketplace: customers post a job with a photo and questionnaire, contractors browse the **HaulBoard** and send estimates, the customer picks one, and payment is held until the job is verified done.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router (TypeScript), installable PWA |
| Auth | Clerk |
| Database | PostgreSQL via Prisma for production |
| Payments | Stripe (SetupIntent, PaymentIntents/manual capture, Connect) |
| Notifications | Web Push + in-app notification center |
| UI | Tailwind CSS |
| Pickup tracking | Browser GPS + Leaflet/OpenStreetMap + Google Maps navigation |

## Pickup tracking and arrival verification

For timed pickups, the customer captures GPS while physically at the pickup address. The job stores the pickup coordinates and the customer's IANA timezone. The assigned contractor gets a reminder 45 minutes before pickup, can open the pickup map and external turn-by-turn navigation, and can use **I've Arrived** during the 45-minute arrival window.

Arrival verification is enforced server-side: the contractor must be assigned to the job, the current time must be between 45 minutes before and 45 minutes after the scheduled pickup, GPS accuracy must be within 250 meters, and the reported location must be within 250 meters of the saved pickup coordinates. A verified arrival changes the job to `IN_PROGRESS` and is audit logged.

The pickup watcher runs every 5 minutes. If a timed pickup passes the 45-minute grace period without verified arrival, the payment authorization is cancelled when possible, the original contractor is excluded from that repost, the job returns to the HaulBoard, and eligible contractors are notified. The missed contractor is not notified about the repost as a new job.

The map's on-device contractor marker is live while the contractor has granted GPS permission. Distance is calculated locally. The displayed ETA is intentionally labeled as a rough distance-based estimate; **Navigate** opens Google Maps for real turn-by-turn routing and traffic-aware ETA.

## Customer questionnaire

A posted job includes job type(s), what to expect, number of stories, a required before photo, address, pickup GPS coordinates, and either a set pickup time or "Anytime that day." Contractors receive the questionnaire with the job so they can price the work accurately.

## Payment flow

Customer verifies a payment method before posting. Contractors submit estimates. The customer accepts one estimate. Stripe holds/authorizes the payment according to the configured payment flow, and the contractor receives the payout after the job passes the completion/dispute process. JunkRun tracks the platform fee separately.

## Roles

| Role | Home | Access |
|---|---|---|
| `CUSTOMER` | `/customer/dashboard` | Post jobs, review estimates, pay, dispute, review contractors |
| `HAULER` | `/hauler/loads` | Browse the HaulBoard, estimate/pass, navigate to pickups, complete jobs, manage verification |
| `ADMIN` | `/admin/ops` | Operations, verification, finance, disputes |
| `OWNER` | `/admin/ops` | Full administrative access |

## Production deployment

1. Use PostgreSQL and set `DATABASE_URL` in Vercel.
2. Run Prisma migrations during deployment (`prisma migrate deploy`).
3. Add Clerk, Stripe, Web Push/VAPID, and `CRON_SECRET` environment variables from `.env.example`.
4. Configure Clerk and Stripe webhooks for the production domain.
5. Vercel Cron runs pickup watching every 5 minutes, auto-return every 30 minutes, and the weekly payout summary on Mondays.
6. Test customer posting, contractor estimating/acceptance, pickup reminders, GPS arrival, missed-pickup reposting, payment state transitions, photo evidence, disputes, and payouts in a Vercel preview/staging environment before production.

### Database migration

The current schema uses PostgreSQL. The pickup-tracking migrations add pickup coordinates, arrival evidence, missed-pickup state, contractor exclusions, and the stored pickup timezone. Apply all migrations before using the pickup tracking flow.

## Important operational notes

- GPS coordinates are location data. Restrict access to the assigned contractor/customer/admin paths and avoid exposing raw coordinates in public HaulBoard responses.
- Browser GPS requires HTTPS and user permission in production.
- The customer should capture pickup GPS while physically at the pickup location; GPS is not an address geocoder.
- A map tile provider is not a turn-by-turn routing service. The app uses the map for situational awareness and Google Maps for navigation.
- Never put Clerk secret keys, Stripe secret keys, webhook secrets, database credentials, or VAPID private keys in client-side code or GitHub source.
