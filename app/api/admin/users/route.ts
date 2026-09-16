import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateDbUser } from '@/lib/auth'
import { clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'

const PatchSchema = z.object({ userId: z.string().min(1), role: z.enum(['CUSTOMER', 'HAULER', 'ADMIN']) })

export const dynamic = 'force-dynamic'

async function audit(actorUserId: string, action: string, entityId: string, metadata?: Record<string, unknown>) {
  await db.auditLog.create({ data: { actorUserId, action, entityType: 'USER', entityId, metadata: metadata ? JSON.stringify(metadata) : null } })
}

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser || !['ADMIN', 'OWNER'].includes(dbUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const role = req.nextUrl.searchParams.get('role')
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1))
  const take = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 50)))
  if (role && !['CUSTOMER', 'HAULER', 'ADMIN', 'OWNER'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  const users = await db.user.findMany({
    where: { ...(role ? { role } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) },
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take,
    select: { id: true, name: true, email: true, phone: true, role: true, contractorType: true, createdAt: true, haulerProfile: { select: { companyName: true, verified: true, rating: true, jobCount: true } }, _count: { select: { customerJobs: true, messagesSent: true } } },
  })
  return NextResponse.json({ users, page, limit: take })
}

export async function PATCH(req: NextRequest) {
  const dbUser = await getOrCreateDbUser()
  if (!dbUser || !['ADMIN', 'OWNER'].includes(dbUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 422 })
  const { userId, role } = parsed.data
  if (userId === dbUser.id) return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 })
  if (role === 'ADMIN' && dbUser.role !== 'OWNER') return NextResponse.json({ error: 'Only OWNER can grant ADMIN access' }, { status: 403 })
  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'OWNER') return NextResponse.json({ error: 'Cannot change OWNER role' }, { status: 403 })

  const updated = await db.user.update({ where: { id: userId }, data: { role } })
  if (role === 'HAULER') {
    await db.haulerProfile.upsert({ where: { userId }, update: {}, create: { userId, companyName: updated.name ? `${updated.name}'s Hauling` : 'New Contractor' } })
  } else if (target.role === 'HAULER' && role === 'CUSTOMER') {
    await db.haulerProfile.updateMany({ where: { userId }, data: { acceptingLoads: false } })
  }
  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(updated.clerkId, { publicMetadata: { role } })
  } catch (err) {
    console.error('Clerk role sync failed', err)
  }
  await audit(dbUser.id, 'USER_ROLE_CHANGED', userId, { from: target.role, to: role })
  return NextResponse.json({ user: { id: updated.id, role: updated.role, name: updated.name } })
}
