'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RunMaintenanceButton({ job, label }: { job: 'auto-return' | 'weekly-summary'; label: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/run-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      })
      const data = await res.json()
      setResult(job === 'auto-return' ? `${data.returned} job(s) returned` : `${data.haulers} contractor(s) summarized`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={loading}
        onClick={run}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {loading ? 'Running…' : label}
      </button>
      {result && <span className="text-xs text-slate-400">{result}</span>}
    </div>
  )
}
