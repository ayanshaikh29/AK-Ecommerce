'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, ArrowRight } from 'lucide-react'

export function CompareFloatingBar() {
  const [list, setList] = useState([])
  const [mounted, setMounted] = useState(false)

  const sync = useCallback(() => {
    try {
      const stored = localStorage.getItem('compare_products')
      setList(stored ? JSON.parse(stored) : [])
    } catch {
      setList([])
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    sync()
    window.addEventListener('compare-updated', sync)
    return () => {
      window.removeEventListener('compare-updated', sync)
    }
  }, [sync])

  const clear = () => {
    localStorage.removeItem('compare_products')
    window.dispatchEvent(new Event('compare-updated'))
  }

  if (!mounted || list.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-primary border border-accent/25 px-5 py-3 rounded-full flex items-center gap-4 shadow-dramatic animate-in fade-in slide-in-from-bottom-5 duration-300">
      <span className="text-xs md:text-sm font-semibold text-white">
        Compare <strong className="text-accent">{list.length}</strong> product{list.length > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Link href="/compare">
          <button className="bg-accent text-accent-foreground text-xs font-bold px-4 py-2 rounded-full hover:scale-105 transition flex items-center gap-1">
            Compare Now <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
        <button onClick={clear} className="text-white/60 hover:text-white p-1 hover:bg-white/10 rounded-full transition" aria-label="Clear selection">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
