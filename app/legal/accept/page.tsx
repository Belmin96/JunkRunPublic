'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const labels: Record<string,string>={TERMS_OF_SERVICE:'Terms of Service',PRIVACY_POLICY:'Privacy Policy',PROHIBITED_MATERIALS:'Prohibited Materials & Safety Policy',CANCELLATION_REFUND:'Cancellation & Refund Policy',DISPUTE_POLICY:'Dispute & Evidence Policy',CONTRACTOR_AGREEMENT:'Contractor Agreement',INDEPENDENT_CONTRACTOR:'Independent Contractor / 1099 Terms',SAFETY_INSURANCE:'Safety & Insurance Acknowledgment'}
const paths: Record<string,string>={TERMS_OF_SERVICE:'terms',PRIVACY_POLICY:'privacy',CONTRACTOR_AGREEMENT:'contractor-agreement',INDEPENDENT_CONTRACTOR:'independent-contractor',PROHIBITED_MATERIALS:'prohibited-materials',CANCELLATION_REFUND:'cancellation-refund',DISPUTE_POLICY:'disputes',SAFETY_INSURANCE:'safety-insurance'}

export default function LegalAcceptancePage(){
 const router=useRouter()
 const [required,setRequired]=useState<string[]>([])
 const [accepted,setAccepted]=useState<Record<string,boolean>>({})
 const [contractorType,setContractorType]=useState<'INDEPENDENT_CONTRACTOR'|'BUSINESS'>('INDEPENDENT_CONTRACTOR')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')

 useEffect(()=>{fetch('/api/legal/status').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load legal documents.');if(d.accepted){router.replace('/redirect');return}const docs=d.required??[];setRequired(docs);setAccepted(Object.fromEntries(docs.map((x:string)=>[x,false])))}).catch(e=>setError(e instanceof Error?e.message:'Unable to load legal documents.')).finally(()=>setLoading(false))},[router])

 const allAccepted=required.length>0&&required.every(doc=>accepted[doc]===true)

 async function submit(){
  if(!allAccepted)return
  setSaving(true);setError('')
  try{
   const res=await fetch('/api/legal/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:required.filter(doc=>accepted[doc]),...(required.includes('CONTRACTOR_AGREEMENT')?{contractorType}:{})})})
   const data=await res.json()
   if(!res.ok)throw new Error(data.error||'Unable to save acceptance')
   router.replace('/redirect')
  }catch(e){setError(e instanceof Error?e.message:'Unable to save acceptance')}finally{setSaving(false)}
 }

 if(loading)return <main className="mx-auto max-w-2xl p-6"><p>Loading legal documents…</p></main>

 return <main className="mx-auto max-w-2xl p-6">
  <h1 className="text-3xl font-bold">Before you continue</h1>
  <p className="mt-3 text-slate-600">Please review and accept each JunkRun document that applies to your account. Your acceptance is recorded with the document version.</p>
  <div className="mt-6 space-y-3">
   {required.map(doc=><label key={doc} className="flex items-start gap-3 rounded-lg border p-4">
    <input type="checkbox" checked={accepted[doc]===true} onChange={e=>setAccepted(prev=>({...prev,[doc]:e.target.checked}))} className="mt-1"/>
    <span><a className="font-semibold underline" href={`/legal/${paths[doc]??doc.toLowerCase()}`} target="_blank" rel="noreferrer">{labels[doc]??doc}</a></span>
   </label>)}
  </div>
  {required.includes('CONTRACTOR_AGREEMENT')&&<div className="mt-6 rounded-lg border p-4">
   <p className="font-semibold">Contractor business type</p>
   <label className="mt-3 block"><input type="radio" checked={contractorType==='INDEPENDENT_CONTRACTOR'} onChange={()=>setContractorType('INDEPENDENT_CONTRACTOR')}/><span className="ml-2">Independent contractor (individual / no LLC required)</span></label>
   <label className="mt-3 block"><input type="radio" checked={contractorType==='BUSINESS'} onChange={()=>setContractorType('BUSINESS')}/><span className="ml-2">Business</span></label>
  </div>}
  <p className="mt-6 text-sm text-slate-500">By selecting each checkbox and continuing, you confirm that you reviewed the documents and agree to the versions presented.</p>
  {error&&<p className="mt-4 text-sm text-red-600">{error}</p>}
  <button disabled={!allAccepted||saving} onClick={submit} className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-bold text-white disabled:opacity-40">{saving?'Saving…':'I Agree & Continue'}</button>
 </main>
}
