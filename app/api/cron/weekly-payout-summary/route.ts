/**
 * POST /api/cron/weekly-payout-summary?weeksAgo=1
 * Rolls up last week's COMPLETED jobs per contractor into a WeeklyPayout row
 * — hauler payout and JunkRun's platform fee tracked as two separate totals.
 * Wire to Vercel Cron (Mondays) or trigger from /admin/finance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { runWeeklyPayoutSummary } from '@/lib/jobs-maintenance'

export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req)
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await runWeeklyPayoutSummary(Number(searchParams.get('weeksAgo') ?? '1'))
  return NextResponse.json(result)
}

export const GET = POST
