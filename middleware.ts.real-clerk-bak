import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',   // Stripe/Clerk webhooks are unauthenticated (verified by signature)
  '/api/cron(.*)',       // cron routes are protected by CRON_SECRET, not a Clerk session
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isHaulerRoute = createRouteMatcher(['/hauler(.*)'])
const isCustomerRoute = createRouteMatcher(['/customer(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return // no auth required

  const { userId, sessionClaims } = await auth.protect()
  const role = (sessionClaims?.metadata as { role?: string })?.role

  // /redirect — send users to their role-specific dashboard
  if (req.nextUrl.pathname === '/redirect') {
    const dest =
      role === 'ADMIN' || role === 'OWNER'
        ? '/admin/ops'
        : role === 'HAULER'
          ? '/hauler/dashboard'
          : '/customer/dashboard'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // Guard admin routes
  if (isAdminRoute(req) && role !== 'ADMIN' && role !== 'OWNER') {
    return NextResponse.redirect(new URL('/customer/dashboard', req.url))
  }

  // Guard hauler routes
  if (isHaulerRoute(req) && role !== 'HAULER' && role !== 'ADMIN' && role !== 'OWNER') {
    return NextResponse.redirect(new URL('/customer/dashboard', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
}
