'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const labels: Record<string, string> = {
  TERMS_OF_SERVICE: 'Terms of Service', PRIVACY_POLICY: 'Privacy Policy', PROHIBITED_MATERIALS: 'Prohibited Materials & Safety Policy', CANCELLATION_REFUND: 'Cancellation & Refund Policy', DISPUTE_POLICY: 'Dispute & Evidence Policy', CONTRACTOR_AGREEMENT: 'Contractor Agreement', INDEPENDENT_CONTRACTOR: 'Independent Contractor / 1099 Terms', SAFETY_INSURANCE: 'Safety & Insurance Acknowledgment',
}

export default function LegalAcceptancePage() {
  const router = useRouter()
  const [required, setRequired] = useState<string[]>([])
  const [accepted, setAccepted] = useState(false)
  const [contractorType, setContractorType] = useState<'INDEPENDENT_CONTRACTOR' | 'BUSINESS'>('INDEPENDENT_CONTRACTOR')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetch('/api/legal/status').then(r => r.json()).then(data => { if (data.accepted) router.replace('/'); else setRequired(data.required ?? []) }).catch(() => setError('Unable to load legal documents.')).finally(() => setLoading(false)) }, [router])

  async function submit() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/legal/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: required, ...(required.includes('CONTRACTOR_AGREEMENT') ? { contractorType } : {}) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to save acceptance')
      router.replace(required.includes('CONTRACTOR_AGREEMENT') ? '/hauler/dashboard' : '/customer/dashboard')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save acceptance') } finally { setSaving(false) }
  }

  if (loading) return <main className="mx-auto max-w-2xl p-6"><p>Loading legal documents…</p></main>
  return <main className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">Before you continue</h1><p className="mt-3 text-slate-600">Please review and accept the JunkRun documents that apply to your account. Your acceptance is recorded with the document version.</p><div className="mt-6 space-y-3">{required.map(doc => <label key={doc} className="flex items-start gap-3 rounded-lg border p-4"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" /><span><a className="font-semibold underline" href={`/legal/${doc === 'TERMS_OF_SERVICE' ? 'terms' : doc === 'PRIVACY_POLICY' ? 'privacy' : doc === 'CONTRACTOR_AGREEMENT' ? 'contractor-agreement' : doc === 'INDEPENDENT_CONTRACTOR' ? 'independent-contractor' : doc === 'PROHIBITED_MATERIALS' ? 'prohibited-materials' : doc === 'CANCELLATION_REFUND' ? 'cancellation-refund' : doc === 'DISPUTE_POLICY' ? 'disputes' : 'safety-insurance'}`} target="_blank">{labels[doc]}</a></span></label>)}</div>{required.includes('CONTRACTOR_AGREEMENT') && <div className="mt-6 rounded-lg border p-4"><p className="font-semibold">Contractor business type</p><label className="mt-3 block"><input type="radio" checked={contractorType === 'INDEPENDENT_CONTRACTOR'} onChange={() => setContractorType('INDEPENDENT_CONTRACTOR')} /> <span className="ml-2">Independent contractor (individual / no LLC required)</span></label><label className="mt-3 block"><input type="radio" checked={contractorType === 'BUSINESS'} onChange={() => setContractorType('BUSINESS')} /> <span className="ml-2">Business</span></label></div>}<p className="mt-6 text-sm text-slate-500">By selecting the checkbox and continuing, you confirm that you reviewed the documents and agree to the versions presented. These documents should be finalized by qualified counsel before production use.</p>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<button disabled={!accepted || saving} onClick={submit} className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'I Agree & Continue'}</button></main>
}
