/**
 * lib/demo-auth/identities.ts
 *
 * Demo-mode personas. Each maps 1:1 to a seeded User row (see prisma/seed.ts)
 * so switching personas shows real, already-seeded data — no real Clerk
 * instance required. See DEMO.md for how this fits together.
 */
export type DemoPersona = {
  clerkId: string
  role: 'CUSTOMER' | 'HAULER' | 'OWNER'
  firstName: string
  lastName: string
  email: string
  phone?: string
  label: string
}

export const DEMO_PERSONAS: Record<string, DemoPersona> = {
  customer: {
    clerkId: 'seed_customer_001',
    role: 'CUSTOMER',
    firstName: 'Alice',
    lastName: 'Customer',
    email: 'customer@example.com',
    phone: '555-100-1001',
    label: 'Customer — Alice',
  },
  hauler: {
    clerkId: 'seed_hauler_001',
    role: 'HAULER',
    firstName: 'Bob',
    lastName: 'Rivera',
    email: 'bob@example.com',
    phone: '555-200-2002',
    label: 'Contractor — Bob (verified)',
  },
  hauler2: {
    clerkId: 'seed_hauler_002',
    role: 'HAULER',
    firstName: 'Carol',
    lastName: 'Nguyen',
    email: 'carol@example.com',
    phone: '555-300-3003',
    label: 'Contractor — Carol (pending)',
  },
  admin: {
    clerkId: 'seed_owner_001',
    role: 'OWNER',
    firstName: 'JunkRun',
    lastName: 'Owner',
    email: 'owner@junkrun.com',
    label: 'Admin — Owner',
  },
}

export const DEMO_COOKIE = 'demo_persona'
