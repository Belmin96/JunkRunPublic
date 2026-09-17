import { NextResponse } from 'next/server'
import { getOrCreateDbUser } from '@/lib/auth'
import { hasAcceptedLegal, LEGAL_VERSIONS, CUSTOMER_LEGAL, CONTRACTOR_LEGAL, type LegalDocument } from '@/lib/legal'

export async function GET() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const required: LegalDocument[] = user.role === 'HAULER' ? CONTRACTOR_LEGAL : CUSTOMER_LEGAL
  return NextResponse.json({ accepted: await hasAcceptedLegal(user.id, required), required, versions: LEGAL_VERSIONS })
}
