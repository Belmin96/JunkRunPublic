/**
 * POST /api/haulers/insurance
 * Body: { docUrl } — a data URL or hosted URL of the uploaded insurance doc.
 * Resets insuranceVerified to false; an admin re-verifies before the
 * contractor's "Verified Pro" badge comes back on.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docUrl } = await req.json()
  if (!docUrl) return NextResponse.json({ error: 'docUrl required' }, { status: 400 })

  const haulerProfile = await db.haulerProfile.update({
    where: { userId: user.id },
    data: {
      insuranceDocUrl: docUrl,
      insuranceUploadedAt: new Date(),
      insuranceVerified: false,
      verified: false,
    },
  })
  return NextResponse.json(haulerProfile)
}
