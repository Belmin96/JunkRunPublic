import { db } from '@/lib/db'

export const LEGAL_VERSIONS = {
  TERMS_OF_SERVICE: '2026-09-17-v1',
  PRIVACY_POLICY: '2026-09-17-v1',
  CONTRACTOR_AGREEMENT: '2026-09-17-v1',
  INDEPENDENT_CONTRACTOR: '2026-09-17-v1',
  PROHIBITED_MATERIALS: '2026-09-17-v1',
  CANCELLATION_REFUND: '2026-09-17-v1',
  DISPUTE_POLICY: '2026-09-17-v1',
  SAFETY_INSURANCE: '2026-09-17-v1',
} as const

export type LegalDocument = keyof typeof LEGAL_VERSIONS

export const CUSTOMER_LEGAL: LegalDocument[] = [
  'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'PROHIBITED_MATERIALS', 'CANCELLATION_REFUND', 'DISPUTE_POLICY',
]

export const CONTRACTOR_LEGAL: LegalDocument[] = [
  ...CUSTOMER_LEGAL, 'CONTRACTOR_AGREEMENT', 'INDEPENDENT_CONTRACTOR', 'SAFETY_INSURANCE',
]

export async function hasAcceptedLegal(userId: string, documents: LegalDocument[]) {
  if (documents.length === 0) return true
  const records = await db.auditLog.findMany({
    where: { actorUserId: userId, action: 'LEGAL_ACCEPTED', entityType: 'LEGAL' },
    select: { entityId: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const accepted = new Set<string>()
  for (const record of records) {
    try {
      const metadata = record.metadata ? JSON.parse(record.metadata) as { document?: string; version?: string } : null
      const document = metadata?.document ?? record.entityId
      if (document && document in LEGAL_VERSIONS && metadata?.version === LEGAL_VERSIONS[document as LegalDocument]) accepted.add(document)
    } catch { /* Ignore malformed historical audit metadata. */ }
  }
  return documents.every((document) => accepted.has(document))
}

export async function recordLegalAcceptance(userId: string, documents: LegalDocument[]) {
  if (documents.length === 0) return
  await db.$transaction(documents.map((document) => db.auditLog.create({
    data: {
      actorUserId: userId,
      action: 'LEGAL_ACCEPTED',
      entityType: 'LEGAL',
      entityId: document,
      metadata: JSON.stringify({ document, version: LEGAL_VERSIONS[document], acceptedAt: new Date().toISOString() }),
    },
  })))
}
