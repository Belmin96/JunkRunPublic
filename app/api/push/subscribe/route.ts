import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

/** Body: the raw result of PushSubscription.toJSON() from the browser. */
export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const endpoint: string | undefined = body?.endpoint
  const p256dh: string | undefined = body?.keys?.p256dh
  const auth: string | undefined = body?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()
  if (endpoint) {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
  }
  return NextResponse.json({ success: true })
}
