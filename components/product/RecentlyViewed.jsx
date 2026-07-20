'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export function RecentlyViewed() {
  const [list, setList] = useState([])
  
  useEffect(() => {
    // Reload list on mount
    const stored = localStorage.getItem('recently_viewed')
    if (stored) {
      setList(JSON.parse(stored))
    }
  }, [])

  if (list.length === 0) return null

  return (
    <section className="py-12 border-t bg-secondary/5 mt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          <h3 className="font-display font-extrabold text-xl md:text-2xl text-foreground">Recently Viewed Products</h3>
        </div>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-none">
          {list.map(p => (
            <Link key={p.id} href={`/product/${p.slug}`} className="shrink-0 w-48 md:w-56 block group">
              <Card className="overflow-hidden hover:shadow-elevated transition-all duration-300 border radius-lg bg-card">
                <div className="aspect-square relative overflow-hidden bg-secondary/10 flex items-center justify-center p-4">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-all duration-500"
                    onError={(e) => { e.currentTarget.src = '/placeholder.png' }}
                  />
                </div>
                <CardContent className="p-4">
                  <h4 className="font-bold text-xs md:text-sm truncate text-foreground group-hover:text-primary transition">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-extrabold text-primary text-xs md:text-sm">₹{p.price.toLocaleString('en-IN')}</span>
                    {p.mrp > p.price && (
                      <span className="text-[10px] md:text-[11px] text-muted-foreground line-through">₹{p.mrp.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
