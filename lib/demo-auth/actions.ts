'use server'

/**
 * lib/demo-auth/actions.ts
 * Server Actions backing the demo persona switcher (lib/demo-auth/client.tsx).
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO_COOKIE, DEMO_PERSONAS } from './identities'

export async function signInAsDemo(formData: FormData) {
  const persona = String(formData.get('persona') ?? '')
  if (!DEMO_PERSONAS[persona]) redirect('/sign-in')

  const store = await cookies()
  store.set(DEMO_COOKIE, persona, { path: '/', sameSite: 'lax' })
  redirect('/redirect')
}

export async function signOutDemo() {
  const store = await cookies()
  store.delete(DEMO_COOKIE)
  redirect('/')
}
