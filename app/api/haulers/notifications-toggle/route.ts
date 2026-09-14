/** POST /api/haulers/notifications-toggle — Body: { enabled: boolean }. The "turn off alerts" switch for new HaulBoard jobs. */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled } = await req.json()
  const haulerProfile = await db.haulerProfile.update({
    where: { userId: user.id },
    data: { notificationsEnabled: Boolean(enabled) },
  })
  return NextResponse.json({ notificationsEnabled: haulerProfile.notificationsEnabled })
}
