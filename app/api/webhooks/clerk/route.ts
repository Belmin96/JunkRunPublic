/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhook events to sync user data and set role metadata.
 *
 * Events:
 *   user.created  — create DB user; if unsafeMetadata.role === 'hauler', set HAULER role
 *   user.updated  — sync name / phone
 *
 * Verify webhook signature with CLERK_WEBHOOK_SECRET (Svix).
 */
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

interface ClerkUser {
  id: string
  email_addresses: Array<{ email_address: string }>
  phone_numbers: Array<{ phone_number: string }>
  first_name: string | null
  last_name: string | null
  unsafe_metadata?: { role?: string }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTs = req.headers.get('svix-timestamp')
  const svixSig = req.headers.get('svix-signature')
  const secret = process.env.CLERK_WEBHOOK_SECRET

  if (!secret || !svixId || !svixTs || !svixSig) {
    return NextResponse.json({ error: 'Missing Svix headers or secret' }, { status: 400 })
  }

  let payload: { type: string; data: ClerkUser }
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    }) as { type: string; data: ClerkUser }
  } catch (err) {
    console.error('Clerk webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = payload
  const email = data.email_addresses[0]?.email_address ?? ''
  const phone = data.phone_numbers[0]?.phone_number ?? null
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

  if (type === 'user.created') {
    // Determine role from sign-up unsafeMetadata.
    // Works for both email/password and Google OAuth sign-ups because
    // the SignUp component's unsafeMetadata prop is persisted by Clerk
    // regardless of sign-up method.
    const unsafeRole = data.unsafe_metadata?.role?.toLowerCase()
    const dbRole = unsafeRole === 'hauler' ? 'HAULER' : 'CUSTOMER'

    await db.user.upsert({
      where: { clerkId: data.id },
      update: { name, phone },
      create: { clerkId: data.id, email, name, phone, role: dbRole },
    })

    // Write role into Clerk public metadata so session claims carry it
    const client = await clerkClient()
    await client.users.updateUserMetadata(data.id, {
      publicMetadata: { role: dbRole },
    })

    // Auto-create HaulerProfile stub if needed
    if (dbRole === 'HAULER') {
      const dbUser = await db.user.findUnique({ where: { clerkId: data.id } })
      if (dbUser) {
        await db.haulerProfile.upsert({
          where: { userId: dbUser.id },
          update: {},
          create: { userId: dbUser.id, companyName: name ? `${name}'s Hauling` : 'New Contractor' },
        })
      }
    }
  }

  if (type === 'user.updated') {
    await db.user.updateMany({
      where: { clerkId: data.id },
      data: { name, phone },
    })
  }

  return NextResponse.json({ success: true })
}
