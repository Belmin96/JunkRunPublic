/**
 * Pickup-window maintenance endpoint.
 * The database pickupDeadlineAt is authoritative; this endpoint is only the
 * background worker that performs the repost and notifications.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { runAutoReturn } from '@/lib/jobs-maintenance'

export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req)
  if (denied) return denied
  try {
    return NextResponse.json(await runAutoReturn())
  } catch (error) {
    console.error('Pickup auto-return failed', error)
    return NextResponse.json({ error: 'Pickup maintenance failed' }, { status: 500 })
  }
}

export const GET = POST
