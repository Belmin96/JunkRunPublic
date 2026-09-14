'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnSecondary } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function InsuranceUpload({ docUrl, verified }: { docUrl: string | null; verified: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/haulers/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docUrl: dataUrl }),
      })
      if (!res.ok) throw new Error('Upload failed')
      router.refresh()
    } catch {
      setError('Could not upload that file — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleChange} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Certificate of insurance</p>
          <p className="text-xs text-slate-500">
            {docUrl ? (verified ? '✓ Verified by JunkRun' : 'Uploaded — pending review') : 'Not uploaded yet'}
          </p>
        </div>
        <button disabled={busy} onClick={() => inputRef.current?.click()} className={btnSecondary}>
          {busy ? 'Uploading…' : docUrl ? 'Replace' : 'Upload'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
