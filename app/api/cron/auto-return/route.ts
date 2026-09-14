/**
 * POST /api/cron/auto-return
 * If a job hasn't been completed within 24h of its scheduled pickup, it
 * bounces back to the HaulBoard: unassigned, estimates & declines cleared,
 * card hold released, both parties notified. Wire this to a scheduler
 * (Vercel Cron every 30 min — see vercel.json) or trigger it manually from
 * /admin/finance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { runAutoReturn } from '@/lib/jobs-maintenance'

export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req)
  if (denied) return denied
  const result = await runAutoReturn()
  return NextResponse.json(result)
}

export const GET = POST
