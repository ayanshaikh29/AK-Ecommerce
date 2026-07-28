'use client'

import React from 'react'
import Link from 'next/link'
import { FileQuestion, Home, ShoppingBag, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-card border border-border/80 rounded-[28px] p-8 sm:p-12 shadow-elevated text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Soft background ambient gradient glow */}
        <div className="absolute -top-20 -left-20 w-52 h-52 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* 404 Badge */}
        <div className="relative mx-auto mb-6 w-20 h-20 shrink-0">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg" />
          <div className="relative w-20 h-20 rounded-full bg-secondary border border-border flex items-center justify-center shadow-soft">
            <FileQuestion className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-extrabold text-foreground mb-2">
          Page Not Found
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto mb-8">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="flex-1">
            <Button className="w-full h-11 rounded-xl gold-gradient text-primary font-extrabold text-xs shadow-soft hover:shadow-glow transition-all flex items-center justify-center gap-1.5">
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </Button>
          </Link>

          <Link href="/products" className="flex-1">
            <Button variant="outline" className="w-full h-11 rounded-xl border-border text-foreground font-bold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span>Browse Products</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
