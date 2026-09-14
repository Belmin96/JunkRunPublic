'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnSecondary } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function DeclineJobButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function decline() {
    setLoading(true)
    try {
      await fetch(`/api/jobs/${jobId}/decline`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={decline} disabled={loading} className={cn(btnSecondary, 'text-slate-400')}>
      {loading ? 'Passing…' : 'Not for me'}
    </button>
  )
}
