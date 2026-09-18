'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/info')
  }, [router])

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
      <div className="relative mb-6 animate-pop">
        <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
        <div className="w-16 h-16 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
          <img src="/myanmarbeer.png" alt="MB" width={64} height={64} className="w-full h-full object-cover rounded-full" />
        </div>
      </div>
      <div className="h-2 w-40 rounded-full shimmer-bg" />
    </div>
  )
}