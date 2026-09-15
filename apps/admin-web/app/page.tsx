'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-lg shadow-[#D4AF37]/20" />
        <p className="text-slate-500 text-sm">Loading dashboard...</p>
      </div>
    </div>
  )
}