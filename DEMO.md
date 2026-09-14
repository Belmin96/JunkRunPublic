# Demo mode — read this first

This copy of JunkRun has real Clerk auth **temporarily swapped for a mock**
so it runs immediately on Replit (or anywhere) with zero setup — no Clerk
account, no API keys, no sign-up flow to fumble through mid-demo.

## What changed

- `next.config.ts` aliases `@clerk/nextjs` and `@clerk/nextjs/server` to
  `lib/demo-auth/client.tsx` and `lib/demo-auth/server.ts` — cookie-based
  stand-ins that implement just what the app calls (`auth()`, `currentUser()`,
  `ClerkProvider`, `UserButton`, `SignIn`, `SignUp`).
- `middleware.ts` is disabled (renamed to `middleware.ts.real-clerk-bak`) —
  it only did Clerk session handling and role-based redirects, both of which
  the mock / each layout's own role check now cover.
- Nothing else was touched. The real `@clerk/nextjs` package is still in
  `package.json` and `node_modules`, just unused while the alias is active.

## Using it

Every page carries a **"Demo mode · jump to"** widget (bottom-right) that
signs you in as one of four seeded personas, straight from `prisma/seed.ts`:

| Persona | Role | Notes |
|---|---|---|
| Alice | Customer | Verified payment method, 4 jobs in different stages |
| Bob | Contractor | Verified pro, 47 jobs |
| Carol | Contractor | Insurance pending — shows the verification queue flow |
| Owner | Admin | Full ops/finance/verification access |

`/sign-in` and `/sign-up` are also replaced with the same persona picker, so
the normal "Sign in" / "Post a job" links on the landing page work too.

Stripe is still unconfigured (placeholder keys) — job posting, browsing, and
estimates all work; a card charge (accepting an estimate, `/customer/payment`)
will fail without real **test-mode** Stripe keys. That's unrelated to this
auth bypass — see the main `README.md`.

## Reverting to real Clerk later

1. Delete the `webpack`/`turbopack` alias block in `next.config.ts`.
2. `mv middleware.ts.real-clerk-bak middleware.ts`.
3. Drop real Clerk (and Stripe, if needed) keys into `.env.local`.
4. Optionally delete `lib/demo-auth/`.
