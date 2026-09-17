/** Scheduled pickup watcher. Run frequently (for example every 5 minutes). */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { runPickupWatch } from '@/lib/jobs-maintenance'

export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req)
  if (denied) return denied
  return NextResponse.json(await runPickupWatch())
}

export const GET = POST
