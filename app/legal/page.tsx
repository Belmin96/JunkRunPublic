import Link from 'next/link'

const policies = [
  ['Terms of Service', '/legal/terms'],
  ['Privacy Policy', '/legal/privacy'],
  ['Contractor Agreement', '/legal/contractor-agreement'],
  ['Independent Contractor / 1099 Terms', '/legal/independent-contractor'],
  ['Prohibited & Hazardous Materials', '/legal/prohibited-materials'],
  ['Cancellation & Refund Policy', '/legal/cancellation-refund'],
  ['Dispute & Evidence Policy', '/legal/disputes'],
  ['Safety & Insurance', '/legal/safety-insurance'],
] as const

export default function LegalIndexPage() {
  return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-bold">JunkRun Legal & Policies</h1><p className="mt-3">Review the policies that govern use of the JunkRun marketplace.</p><div className="mt-8 grid gap-3">{policies.map(([label, href]) => <Link key={href} href={href} className="rounded-lg border p-4 font-medium hover:bg-gray-50">{label}</Link>)}</div><p className="mt-8 text-sm">These documents are product drafts and must be reviewed and finalized by qualified legal counsel before production use.</p></main>
}
