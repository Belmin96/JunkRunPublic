'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CameraCapture from '@/components/CameraCapture'
import { JOB_TYPES } from '@/lib/constants'
import { btnPrimary, btnSecondary, card, input, label as labelCls } from '@/lib/ui'
import { cn } from '@/lib/utils'

const STEPS = ['Job type', 'Details', 'Before photo', 'Address', 'Arrival', 'Review'] as const

export default function BookPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [whatToExpect, setWhatToExpect] = useState('')
  const [numStories, setNumStories] = useState(1)
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null)
  const [pickupAddress, setPickupAddress] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [arrivalType, setArrivalType] = useState<'SET_TIME' | 'ANYTIME'>('SET_TIME')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  function toggleType(t: string) {
    setJobTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const canNext = [
    jobTypes.length > 0,
    true, // details optional
    !!beforePhotoUrl,
    pickupAddress.length > 4 && city.length > 1 && zipCode.length >= 5,
    !!date && (arrivalType === 'ANYTIME' || !!time),
    true,
  ][step]

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTypes,
          whatToExpect: whatToExpect || undefined,
          numStories,
          pickupAddress,
          city,
          zipCode,
          arrivalType,
          date,
          time: arrivalType === 'SET_TIME' ? time : undefined,
          beforePhotoUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'PAYMENT_UNVERIFIED') {
          router.push('/customer/payment?next=/customer/book')
          return
        }
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to post job')
      }
      router.push(`/customer/jobs/${data.jobId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Post a job</h2>
        <p className="mt-1 text-sm text-slate-500">
          Answer a few quick questions and snap a photo — contractors will send you real quotes.
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand' : 'bg-border')} />
        ))}
      </div>

      <div className={card}>
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">What kind of job is this?</h3>
            <p className="text-sm text-slate-500">Pick everything that applies.</p>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                    jobTypes.includes(t)
                      ? 'border-brand bg-brand-light text-brand-dark'
                      : 'border-border text-slate-600 hover:border-brand/50'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">What should the contractor expect?</h3>
            <label className="block">
              <span className={labelCls}>What to expect (parking, gate code, hazards, etc.)</span>
              <textarea
                rows={4}
                className={input}
                placeholder="Items are in the garage, gate code is 1234, watch for the dog…"
                value={whatToExpect}
                onChange={(e) => setWhatToExpect(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelCls}>How many stories?</span>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNumStories((n) => Math.max(1, n - 1))}
                  className="h-9 w-9 rounded-lg border border-border text-lg font-bold hover:border-brand"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold">{numStories}</span>
                <button
                  type="button"
                  onClick={() => setNumStories((n) => Math.min(10, n + 1))}
                  className="h-9 w-9 rounded-lg border border-border text-lg font-bold hover:border-brand"
                >
                  +
                </button>
              </div>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Snap a before photo</h3>
            <p className="text-sm text-slate-500">Required — this is what contractors quote from.</p>
            <CameraCapture label="Take before photo" value={beforePhotoUrl} onCapture={setBeforePhotoUrl} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Where's the pickup?</h3>
            <label className="block">
              <span className={labelCls}>Address</span>
              <input className={input} placeholder="123 Main St" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>City</span>
                <input className={input} placeholder="Phoenix" value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>ZIP code</span>
                <input className={input} placeholder="85001" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold">When works for you?</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArrivalType('SET_TIME')}
                className={cn('flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold', arrivalType === 'SET_TIME' ? 'border-brand bg-brand-light text-brand-dark' : 'border-border text-slate-600')}
              >
                Set a time
              </button>
              <button
                type="button"
                onClick={() => setArrivalType('ANYTIME')}
                className={cn('flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold', arrivalType === 'ANYTIME' ? 'border-brand bg-brand-light text-brand-dark' : 'border-border text-slate-600')}
              >
                Anytime that day
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Date</span>
                <input type="date" min={new Date().toISOString().split('T')[0]} className={input} value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              {arrivalType === 'SET_TIME' && (
                <label className="block">
                  <span className={labelCls}>Time</span>
                  <input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Review &amp; post</h3>
            <dl className="space-y-2 text-sm">
              <Row k="Job types" v={jobTypes.join(', ')} />
              <Row k="Stories" v={String(numStories)} />
              <Row k="Address" v={`${pickupAddress}, ${city} ${zipCode}`} />
              <Row k="Arrival" v={arrivalType === 'ANYTIME' ? `${date} · Anytime` : `${date} at ${time}`} />
            </dl>
            {beforePhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforePhotoUrl} alt="Before" className="h-40 w-full rounded-xl object-cover" />
            )}
            <p className="text-xs text-slate-500">
              Your card won&apos;t be charged now — contractors will send estimates and you pick who does the job.
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className={cn(btnSecondary, 'flex-1')}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)} className={cn(btnPrimary, 'flex-1')}>
              Continue
            </button>
          ) : (
            <button type="button" disabled={loading} onClick={submit} className={cn(btnPrimary, 'flex-1')}>
              {loading ? 'Posting…' : 'Post job'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-ink text-right">{v}</dd>
    </div>
  )
}
