import { db } from '@/lib/db'

export const LEGAL_VERSIONS = {
  TERMS_OF_SERVICE: '2026-09-17-v1',
  PRIVACY_POLICY: '2026-09-17-v1',
  CONTRACTOR_AGREEMENT: '2026-09-17-v1',
  INDEPENDENT_CONTRACTOR: '2026-09-17-v1',
  PROHIBITED_MATERIALS: '2026-09-17-v1',
  CANCELLATION_REFUND: '2026-09-17-v1',
  DISPUTE_POLICY: '2026-09-17-v1',
} as const

export type LegalDocument = keyof typeof LEGAL_VERSIONS

export async function hasAcceptedLegal(userId: string, documents: LegalDocument[]) {
  if (documents.length === 0) return true
  const records = await db.auditLog.findMany({
    where: { actorUserId: userId, action: 'LEGAL_ACCEPTED', entityType: 'LEGAL' },
    select: { entityId: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const accepted = new Set<string>()
  for (const record of records) {
    try {
      const metadata = record.metadata ? JSON.parse(record.metadata) as { document?: string; version?: string } : null
      if (metadata?.document && metadata.version === LEGAL_VERSIONS[metadata.document as LegalDocument]) accepted.add(metadata.document)
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
