import { NextResponse } from 'next/server'
import { getOrCreateDbUser } from '@/lib/auth'

export async function GET() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    paymentVerified: user.paymentVerified,
    cardBrand: user.cardBrand,
    cardLast4: user.cardLast4,
  })
}
