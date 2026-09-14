'use client'
import { useEffect } from 'react'

/** Mounted once in the root layout so the PWA service worker (push, installability) is always active. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
