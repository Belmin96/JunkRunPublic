import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export const ROLES = ['CUSTOMER', 'HAULER', 'ADMIN', 'OWNER'] as const
export type Role = typeof ROLES[number]

export async function getOrCreateDbUser() {
  const { userId } = await auth(); if (!userId) return null
  const clerkUser = await currentUser(); if (!clerkUser) return null
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@users.junkrun.invalid`
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null
  const phone = clerkUser.phoneNumbers[0]?.phoneNumber ?? null
  return db.user.upsert({ where: { clerkId: userId }, update: { email, name, phone }, create: { clerkId: userId, email, name, phone, role: 'CUSTOMER' }, include: { haulerProfile: true } })
}

export async function getSessionRole(): Promise<Role | null> {
  const user = await getOrCreateDbUser(); if (!user || !ROLES.includes(user.role as Role)) return null
  return user.role as Role
}

export async function requireRole(...roles: Role[]) {
  const role = await getSessionRole(); if (!role || !roles.includes(role)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  return null
}
