'use client'
import { useRef, useState } from 'react'

interface Props {
  label: string
  value: string | null
  onCapture: (dataUrl: string) => void
  disabled?: boolean
}

/**
 * Camera-only capture — the `capture="environment"` attribute opens the
 * device camera directly on mobile browsers instead of the photo library, so
 * before/after job photos can't be swapped in from an old gallery shot. The
 * image is compressed client-side to a small JPEG data URL before upload.
 */
export default function CameraCapture({ label, value, onCapture, disabled }: Props) {
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
      const dataUrl = await compress(file)
      onCapture(dataUrl)
    } catch {
      setError('Could not read that photo — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-48 w-full rounded-xl border border-border object-cover" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 rounded-lg bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-ink"
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-2 text-slate-400 transition hover:border-brand hover:text-brand-dark disabled:opacity-50"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">{busy ? 'Processing…' : label}</span>
          <span className="text-[11px] text-slate-400">Camera only — no photo library</span>
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

async function compress(file: File, maxDim = 1280, quality = 0.72): Promise<string> {
  const bitmap = await decode(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unsupported')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img>-based decode below
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
