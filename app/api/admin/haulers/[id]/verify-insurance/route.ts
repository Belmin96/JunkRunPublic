/** POST /api/admin/haulers/[id]/verify-insurance — Body: { approve: boolean } */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'OWNER'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { approve } = await req.json()

  const hauler = await db.haulerProfile.update({
    where: { id },
    data: { insuranceVerified: Boolean(approve), verified: Boolean(approve) },
  })

  await notifyUser({
    userId: hauler.userId,
    type: 'VERIFICATION',
    title: approve ? 'You’re a Verified Pro ✓' : 'Insurance verification needs another look',
    body: approve
      ? 'Your insurance has been verified. The Verified Pro badge now shows on your profile.'
      : 'An admin could not verify your insurance document — please re-upload a clear copy.',
    url: '/hauler/profile',
  })

  return NextResponse.json(hauler)
}
