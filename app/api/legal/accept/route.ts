import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrCreateDbUser } from '@/lib/auth'
import { LEGAL_VERSIONS, recordLegalAcceptance, type LegalDocument } from '@/lib/legal'

const Schema = z.object({
  documents: z.array(z.enum([
    'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'CONTRACTOR_AGREEMENT', 'INDEPENDENT_CONTRACTOR',
    'PROHIBITED_MATERIALS', 'CANCELLATION_REFUND', 'DISPUTE_POLICY',
  ])).min(1).max(7),
  contractorType: z.enum(['INDEPENDENT_CONTRACTOR', 'BUSINESS']).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid legal acceptance request' }, { status: 422 })

  const required: LegalDocument[] = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'PROHIBITED_MATERIALS', 'CANCELLATION_REFUND', 'DISPUTE_POLICY']
  if (user.role === 'HAULER') required.push('CONTRACTOR_AGREEMENT', 'INDEPENDENT_CONTRACTOR')
  const requested = new Set(parsed.data.documents)
  const missing = required.filter((document) => !requested.has(document))
  if (missing.length) return NextResponse.json({ error: 'Required policies must all be accepted', missing, versions: LEGAL_VERSIONS }, { status: 422 })

  if (parsed.data.contractorType && user.role !== 'HAULER') return NextResponse.json({ error: 'Contractor type is only valid for contractors' }, { status: 422 })
  if (parsed.data.contractorType) await import('@/lib/db').then(({ db }) => db.user.update({ where: { id: user.id }, data: { contractorType: parsed.data.contractorType } }))

  await recordLegalAcceptance(user.id, parsed.data.documents as LegalDocument[])
  return NextResponse.json({ accepted: parsed.data.documents, versions: LEGAL_VERSIONS })
}
