'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, card } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function ReviewForm({ jobId, target }: { jobId: string; target: 'contractor' | 'customer' }) {
  const router = useRouter()
  const [stars, setStars] = useState(5)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, stars, note: note || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Could not submit review')
      }
      setSubmitted(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className={card}>
        <p className="text-center text-sm font-semibold text-brand-dark">Thanks for the review! 🎉</p>
      </div>
    )
  }

  return (
    <div className={card}>
      <h3 className="font-semibold text-ink">Rate the {target}</h3>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setStars(n)} className="text-2xl leading-none">
            {n <= stars ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        placeholder="Optional note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <button disabled={loading} onClick={submit} className={cn(btnPrimary, 'mt-3 w-full')}>
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
