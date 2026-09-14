'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserRoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [role, setRole]       = useState(currentRole)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const router = useRouter()

  async function handleChange(newRole: string) {
    if (newRole === currentRole) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed')
        setRole(currentRole)
      } else {
        setRole(newRole)
        router.refresh()
      }
    } catch {
      setError('Network error')
      setRole(currentRole)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-brand focus:outline-none disabled:opacity-50"
      >
        <option value="CUSTOMER">Customer</option>
        <option value="HAULER">Hauler</option>
        <option value="ADMIN">Admin</option>
      </select>
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
      {error  && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
