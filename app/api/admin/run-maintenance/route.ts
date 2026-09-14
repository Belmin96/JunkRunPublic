/**
 * POST /api/admin/run-maintenance
 * Body: { job: 'auto-return' | 'weekly-summary' }
 * Lets an admin trigger the same maintenance jobs Vercel Cron runs
 * automatically, from the /admin/finance "run now" buttons.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateDbUser } from '@/lib/auth'
import { runAutoReturn, runWeeklyPayoutSummary } from '@/lib/jobs-maintenance'

export async function POST(req: NextRequest) {
  const user = await getOrCreateDbUser()
  if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { job } = await req.json()
  if (job === 'auto-return') return NextResponse.json(await runAutoReturn())
  if (job === 'weekly-summary') return NextResponse.json(await runWeeklyPayoutSummary(1))
  return NextResponse.json({ error: 'Unknown job' }, { status: 400 })
}
