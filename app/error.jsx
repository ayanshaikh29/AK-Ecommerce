'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalRouteError({ error, reset }) {
  useEffect(() => {
    console.error('[Global App Route Error Caught]:', error)
  }, [error])

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-card border border-border/80 rounded-[28px] p-8 sm:p-12 shadow-elevated text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Ambient Glow */}
        <div className="absolute -top-20 -left-20 w-52 h-52 bg-destructive/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon Badge */}
        <div className="relative mx-auto mb-6 w-20 h-20 shrink-0">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-lg" />
          <div className="relative w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-soft">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
          Something Went Wrong
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto mb-8">
          We encountered an unexpected problem. The application has caught this route exception safely.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            onClick={() => reset()}
            className="h-11 rounded-xl gold-gradient text-primary font-extrabold text-xs shadow-soft hover:shadow-glow transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="h-11 rounded-xl border-border text-foreground font-bold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
          >
            <span>Refresh Page</span>
          </Button>

          <a href="/" className="col-span-1">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-border text-foreground font-semibold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go Home</span>
            </Button>
          </a>

          <a href="/admin" className="col-span-1">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-border text-foreground font-semibold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Go Dashboard</span>
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
