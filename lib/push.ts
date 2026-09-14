/**
 * Web Push wrapper. This is what makes "notification to phone" real without a
 * paid SMS/push vendor: once a user installs the JunkRun PWA (or just grants
 * browser notification permission) and subscribes, the OS shows a native
 * notification even when the tab/app isn't open — delivered via VAPID keys
 * we control (see .env.example for how to generate a pair).
 *
 * If VAPID keys aren't configured, sendPush silently no-ops so the rest of
 * the app (in-app notification center) still works in dev.
 */
import webpush from 'web-push'

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY

let configured = false
function ensureConfigured() {
  if (configured) return true
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails('mailto:support@junkrun.app', publicKey, privateKey)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/** Send one push. Returns { gone: true } when the subscription is dead and should be deleted. */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return { ok: true, gone: false }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const gone = statusCode === 404 || statusCode === 410
    if (!gone) console.error('web-push send failed:', err)
    return { ok: false, gone }
  }
}

export function pushConfigured(): boolean {
  return Boolean(publicKey && privateKey)
}
