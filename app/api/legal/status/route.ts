import { NextResponse } from 'next/server'
import { getOrCreateDbUser } from '@/lib/auth'
import { hasAcceptedLegal, LEGAL_VERSIONS, type LegalDocument } from '@/lib/legal'

export async function GET() {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const required: LegalDocument[] = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'PROHIBITED_MATERIALS', 'CANCELLATION_REFUND', 'DISPUTE_POLICY']
  if (user.role === 'HAULER') required.push('CONTRACTOR_AGREEMENT', 'INDEPENDENT_CONTRACTOR')
  return NextResponse.json({ accepted: await hasAcceptedLegal(user.id, required), required, versions: LEGAL_VERSIONS })
}
