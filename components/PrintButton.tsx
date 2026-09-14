'use client'
import { btnSecondary } from '@/lib/ui'
import { cn } from '@/lib/utils'

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className={cn(btnSecondary, 'w-full print:hidden')}>
      🖨️ Print / Save as PDF
    </button>
  )
}
