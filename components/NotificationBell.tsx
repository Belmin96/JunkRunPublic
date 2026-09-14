'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { enablePushNotifications, isPushSubscribed } from '@/lib/push-client'

interface Notif {
  id: string
  type: string
  title: string
  body: string
  jobId: string | null
  read: boolean
  createdAt: string
}

/** Bell icon in every layout header — clicking it opens the notification panel. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [enabling, setEnabling] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setItems(await res.json())
    } catch {
      // best-effort — notification center isn't critical-path
    }
  }

  useEffect(() => {
    load()
    isPushSubscribed().then(setSubscribed)
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = items.filter((n) => !n.read).length

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  async function handleEnable() {
    setEnabling(true)
    const res = await enablePushNotifications()
    setSubscribed(res.ok)
    setEnabling(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative rounded-full p-2 text-xl text-ink hover:bg-brand-light transition"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold text-ink">Notifications</p>
            {subscribed === false && (
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="text-xs font-semibold text-brand-dark hover:underline disabled:opacity-50"
              >
                {enabling ? 'Enabling…' : 'Enable alerts'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              items.slice(0, 20).map((n) => (
                <Link
                  key={n.id}
                  href={`/notifications/${n.id}`}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-brand-light/40 transition"
                >
                  <p className="font-medium text-ink">{n.title}</p>
                  <p className="mt-0.5 text-slate-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
