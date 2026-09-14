/**
 * GET /api/admin/messages          — all messages, newest-job-first, paginated
 * GET /api/admin/messages?jobId=   — all messages for one job
 * GET /api/admin/messages?userId=  — all messages sent by a specific user
 *
 * Admin / Owner only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser || !['ADMIN', 'OWNER'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const jobId  = req.nextUrl.searchParams.get('jobId')  ?? undefined
  const userId = req.nextUrl.searchParams.get('userId') ?? undefined
  const take   = Math.min(Number(req.nextUrl.searchParams.get('take') ?? 200), 500)

  const messages = await db.message.findMany({
    where: {
      ...(jobId  ? { jobId }           : {}),
      ...(userId ? { senderId: userId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take,
    include: {
      sender: { select: { id: true, name: true, email: true, role: true, haulerProfile: { select: { companyName: true } } } },
      job:    { select: { id: true, jobNumber: true, status: true } },
    },
  })

  // Group by job for the overview view
  const byJob: Record<string, { job: typeof messages[0]['job']; msgs: typeof messages }> = {}
  for (const m of messages) {
    if (!byJob[m.jobId]) byJob[m.jobId] = { job: m.job, msgs: [] }
    byJob[m.jobId].msgs.push(m)
  }

  return NextResponse.json({ messages, byJob: Object.values(byJob) })
}
