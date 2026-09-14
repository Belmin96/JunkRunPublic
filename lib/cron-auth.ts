import { NextRequest, NextResponse } from 'next/server'

/** Vercel Cron (and the admin "run now" button) call cron routes with this bearer header instead of a Clerk session. */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
