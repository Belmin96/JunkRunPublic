/**
 * GET   /api/admin/users           — list all users
 * PATCH /api/admin/users           — update a user's role
 *
 * Admin / Owner only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { clerkClient } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser || !['ADMIN', 'OWNER'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role   = req.nextUrl.searchParams.get('role')   ?? undefined
  const search = req.nextUrl.searchParams.get('search') ?? undefined

  const users = await db.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(search ? {
        OR: [
          { name:  { contains: search } },
          { email: { contains: search } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      haulerProfile: { select: { companyName: true, verified: true, rating: true, jobCount: true } },
      _count: { select: { customerJobs: true, messagesSent: true } },
    },
  })

  return NextResponse.json({ users })
}

export async function PATCH(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser || !['ADMIN', 'OWNER'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role } = await req.json()
  const validRoles = ['CUSTOMER', 'HAULER', 'ADMIN']
  if (!userId || !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Owners cannot be demoted via API
  const target = await db.user.findUnique({ where: { id: userId } })
  if (target?.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot change OWNER role' }, { status: 403 })
  }

  // Update DB
  const updated = await db.user.update({ where: { id: userId }, data: { role } })

  // Sync to Clerk publicMetadata so session claims update on next sign-in
  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(updated.clerkId, {
      publicMetadata: { role },
    })
  } catch {
    // Non-fatal — DB is source of truth
  }

  // Auto-create HaulerProfile stub if promoting to HAULER
  if (role === 'HAULER') {
    await db.haulerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, companyName: updated.name ? `${updated.name}'s Hauling` : 'New Contractor' },
    })
  }

  return NextResponse.json({ user: updated })
}
