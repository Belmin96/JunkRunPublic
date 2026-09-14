/**
 * prisma/seed.ts
 * Run with: npm run db:seed
 * Creates sample data for local development across every role.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const before = (label: string) => `https://placehold.co/600x400/63C21B/10140C?text=${encodeURIComponent(label)}`
const after = (label: string) => `https://placehold.co/600x400/10140C/63C21B?text=${encodeURIComponent(label)}`

function daysFromNow(d: number, hours = 9) {
  const date = new Date()
  date.setDate(date.getDate() + d)
  date.setHours(hours, 0, 0, 0)
  return date
}

async function main() {
  console.log('🌱 Seeding JunkRun...')

  await db.review.deleteMany()
  await db.notification.deleteMany()
  await db.pushSubscription.deleteMany()
  await db.weeklyPayout.deleteMany()
  await db.jobDecline.deleteMany()
  await db.estimate.deleteMany()
  await db.job.deleteMany()
  await db.haulerProfile.deleteMany()
  await db.user.deleteMany()

  const owner = await db.user.create({
    data: { clerkId: 'seed_owner_001', email: 'owner@junkrun.com', name: 'JunkRun Owner', role: 'OWNER' },
  })

  const customer = await db.user.create({
    data: {
      clerkId: 'seed_customer_001',
      email: 'customer@example.com',
      name: 'Alice Customer',
      phone: '555-100-1001',
      role: 'CUSTOMER',
      // Pretend a card is already verified so the booking flow works end-to-end in dev without real Stripe keys.
      stripeCustomerId: 'cus_seed_alice',
      paymentMethodId: 'pm_seed_alice',
      cardBrand: 'visa',
      cardLast4: '4242',
      paymentVerified: true,
      paymentVerifiedAt: new Date(),
    },
  })

  const bobUser = await db.user.create({
    data: { clerkId: 'seed_hauler_001', email: 'bob@example.com', name: 'Bob Rivera', phone: '555-200-2002', role: 'HAULER' },
  })
  const bob = await db.haulerProfile.create({
    data: {
      userId: bobUser.id,
      companyName: "Bob's Hauling LLC",
      bio: 'Fast, reliable junk removal. 10 years experience.',
      vehicleType: '1-ton pickup',
      serviceArea: 'Phoenix metro · 30 miles',
      acceptingLoads: true,
      verified: true,
      insuranceVerified: true,
      insuranceDocUrl: before('Insurance-Doc'),
      insuranceUploadedAt: new Date(),
      rating: 4.8,
      jobCount: 47,
    },
  })

  const carolUser = await db.user.create({
    data: { clerkId: 'seed_hauler_002', email: 'carol@example.com', name: 'Carol Nguyen', phone: '555-300-3003', role: 'HAULER' },
  })
  const carol = await db.haulerProfile.create({
    data: {
      userId: carolUser.id,
      companyName: 'Nguyen Junk Removal',
      bio: 'New to JunkRun — insurance pending review.',
      vehicleType: 'box truck',
      acceptingLoads: true,
      verified: false,
      rating: 5.0,
      jobCount: 2,
    },
  })

  // ── Job 1: freshly posted, no estimates yet ────────────────────────────────
  const j1 = await db.job.create({
    data: {
      jobNumber: 'JR-0001',
      customerId: customer.id,
      jobTypes: JSON.stringify(['Furniture', 'Mattresses']),
      whatToExpect: 'Items are in the garage. Gate code is 1234.',
      numStories: 1,
      pickupAddress: '1234 Elm Street',
      city: 'Phoenix',
      zipCode: '85001',
      arrivalType: 'SET_TIME',
      date: daysFromNow(2).toISOString().slice(0, 10),
      time: '09:00',
      scheduledAt: daysFromNow(2),
      beforePhotoUrl: before('Furniture'),
      status: 'POSTED',
      paymentStatus: 'PENDING',
    },
  })

  // ── Job 2: has two competing estimates ─────────────────────────────────────
  const j2 = await db.job.create({
    data: {
      jobNumber: 'JR-0002',
      customerId: customer.id,
      jobTypes: JSON.stringify(['Appliances']),
      whatToExpect: 'Fridge and washer are on the second floor — no elevator.',
      numStories: 2,
      pickupAddress: '5678 Oak Avenue',
      city: 'Tempe',
      zipCode: '85281',
      arrivalType: 'ANYTIME',
      date: daysFromNow(1).toISOString().slice(0, 10),
      scheduledAt: daysFromNow(1, 23),
      beforePhotoUrl: before('Appliances'),
      status: 'BIDDING',
      paymentStatus: 'PENDING',
    },
  })
  await db.estimate.create({ data: { jobId: j2.id, haulerId: bob.id, amountCents: 22500, arrival: 'Today 2-4pm', message: 'I can handle the stairs, no problem.' } })
  await db.estimate.create({ data: { jobId: j2.id, haulerId: carol.id, amountCents: 19900, arrival: 'Tomorrow morning' } })

  // ── Job 3: assigned, in progress ───────────────────────────────────────────
  const j3price = 32500
  const j3 = await db.job.create({
    data: {
      jobNumber: 'JR-0003',
      customerId: customer.id,
      haulerId: bob.id,
      jobTypes: JSON.stringify(['Construction Debris', 'Yard Waste']),
      numStories: 1,
      pickupAddress: '900 Desert Rd',
      city: 'Scottsdale',
      zipCode: '85251',
      arrivalType: 'SET_TIME',
      date: new Date().toISOString().slice(0, 10),
      time: '13:00',
      scheduledAt: daysFromNow(0, 13),
      beforePhotoUrl: before('Debris'),
      status: 'IN_PROGRESS',
      priceCents: j3price,
      platformFeeCents: Math.round(j3price * 0.1),
      haulerPayoutCents: j3price - Math.round(j3price * 0.1),
      stripePaymentIntentId: 'pi_seed_003',
      paymentStatus: 'AUTHORIZED',
      authorizedAt: new Date(),
      acceptedAt: new Date(),
      inProgressAt: new Date(),
    },
  })

  // ── Job 4: fully completed, with reviews ───────────────────────────────────
  const j4price = 47500
  const j4 = await db.job.create({
    data: {
      jobNumber: 'JR-0004',
      customerId: customer.id,
      haulerId: bob.id,
      jobTypes: JSON.stringify(['Electronics']),
      numStories: 1,
      pickupAddress: '42 Cactus Ln',
      city: 'Mesa',
      zipCode: '85201',
      arrivalType: 'SET_TIME',
      date: daysFromNow(-3).toISOString().slice(0, 10),
      time: '10:00',
      scheduledAt: daysFromNow(-3, 10),
      beforePhotoUrl: before('Electronics'),
      afterPhotoUrl: after('Cleared'),
      status: 'COMPLETED',
      priceCents: j4price,
      platformFeeCents: Math.round(j4price * 0.1),
      haulerPayoutCents: j4price - Math.round(j4price * 0.1),
      stripePaymentIntentId: 'pi_seed_004',
      stripeTransferId: 'tr_seed_004',
      paymentStatus: 'TRANSFERRED',
      authorizedAt: daysFromNow(-3),
      acceptedAt: daysFromNow(-3),
      inProgressAt: daysFromNow(-3, 10),
      evidenceSubmittedAt: daysFromNow(-2, 15),
      verifiedAt: daysFromNow(-2, 15),
      completedAt: daysFromNow(-2, 16),
    },
  })
  await db.review.create({ data: { jobId: j4.id, targetType: 'HAULER', haulerId: bob.id, raterId: customer.id, raterRole: 'CUSTOMER', stars: 5, note: 'Fast and careful with the furniture!' } })
  await db.review.create({ data: { jobId: j4.id, targetType: 'CUSTOMER', customerId: customer.id, raterId: bobUser.id, raterRole: 'HAULER', stars: 5, note: 'Easy pickup, clear instructions.' } })

  console.log(`✅ Users: ${owner.email}, ${customer.email}, ${bobUser.email} (verified), ${carolUser.email} (unverified)`)
  console.log(`✅ Jobs: ${j1.jobNumber} (POSTED), ${j2.jobNumber} (BIDDING, 2 estimates), ${j3.jobNumber} (IN_PROGRESS), ${j4.jobNumber} (COMPLETED, reviewed)`)
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
