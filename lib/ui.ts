/**
 * Shared Tailwind class fragments so every page shares the same JunkRun look
 * (see globals.css / tailwind.config.ts for the underlying palette).
 */
export const card = 'rounded-2xl border border-border bg-card p-5 shadow-sm'
export const cardHover = 'rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-brand/50 hover:shadow-md transition'
export const input =
  'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const label = 'block text-sm font-medium text-slate-700'
export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-ink hover:bg-brand-dark hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand transition disabled:opacity-50'
export const btnDanger =
  'inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition disabled:opacity-50'
export const pill = 'rounded-full px-2.5 py-0.5 text-xs font-semibold'
export const chip =
  'rounded-full border border-border bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition data-[active=true]:border-brand data-[active=true]:bg-brand-light data-[active=true]:text-brand-dark'
