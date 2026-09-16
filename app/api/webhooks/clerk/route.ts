import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

export const runtime = 'nodejs'
interface ClerkUser { id: string; email_addresses: Array<{ email_address: string }>; phone_numbers: Array<{ phone_number: string }>; first_name: string | null; last_name: string | null; unsafe_metadata?: { role?: string; contractorType?: string } }

export async function POST(req: NextRequest) {
  const body = await req.text(); const svixId = req.headers.get('svix-id'); const svixTs = req.headers.get('svix-timestamp'); const svixSig = req.headers.get('svix-signature'); const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret || !svixId || !svixTs || !svixSig) return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  let payload: { type: string; data: ClerkUser }
  try { payload = new Webhook(secret).verify(body, { 'svix-id': svixId, 'svix-timestamp': svixTs, 'svix-signature': svixSig }) as { type: string; data: ClerkUser } } catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) }
  const { type, data } = payload; const email = data.email_addresses[0]?.email_address ?? ''; const phone = data.phone_numbers[0]?.phone_number ?? null; const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null
  if (type === 'user.created') {
    const requestedHauler = data.unsafe_metadata?.role?.toLowerCase() === 'hauler'
    const contractorType = requestedHauler ? 'INDEPENDENT_CONTRACTOR' : null
    const role = requestedHauler ? 'HAULER' : 'CUSTOMER'
    const user = await db.user.upsert({ where: { clerkId: data.id }, update: { email, name, phone }, create: { clerkId: data.id, email, name, phone, role, contractorType } })
    if (role === 'HAULER') await db.haulerProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, companyName: name ? `${name}'s Hauling` : 'New Contractor' } })
    await db.auditLog.create({ data: { action: 'USER_CREATED', entityType: 'USER', entityId: user.id, metadata: JSON.stringify({ requestedHauler, contractorType }) } })
    try { await (await clerkClient()).users.updateUserMetadata(data.id, { publicMetadata: { role: user.role } }) } catch (err) { console.error('Clerk role sync failed', err) }
  } else if (type === 'user.updated') {
    await db.user.updateMany({ where: { clerkId: data.id }, data: { email, name, phone } })
  } else if (type === 'user.deleted') {
    await db.user.updateMany({ where: { clerkId: data.id }, data: { notificationsEnabled: false, role: 'CUSTOMER' } })
  }
  return NextResponse.json({ success: true })
}
