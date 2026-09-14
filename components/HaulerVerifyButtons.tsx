'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HaulerVerifyButtons({ haulerId }: { haulerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function act(approve: boolean) {
    setLoading(true)
    try {
      await fetch(`/api/admin/haulers/${haulerId}/verify-insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button disabled={loading} onClick={() => act(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-ink hover:bg-brand-dark hover:text-white disabled:opacity-50">
        Approve
      </button>
      <button disabled={loading} onClick={() => act(false)} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-red-400 disabled:opacity-50">
        Reject
      </button>
    </div>
  )
}
