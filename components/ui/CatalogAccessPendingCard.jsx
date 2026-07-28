'use client'

import React, { useState, useEffect } from 'react'
import { Lock, ArrowRight, MessageCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CatalogAccessPendingCard({ user }) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Customer'
  const whatsappText = encodeURIComponent(`Hello AK Enterprises, I would like to request catalog access for my account (${user?.email || 'B2B'}).`)
  const whatsappUrl = `https://wa.me/918308860894?text=${whatsappText}`

  // Check if customer already submitted request
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return

    fetch('/api/catalog-requests/my-status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && (data.hasPending || data.status === 'pending')) {
          setSent(true)
        }
      })
      .catch(() => {})
  }, [user?.id])

  const handleRequestAccess = async () => {
    if (sent || submitting) return
    setSubmitting(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/catalog-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          note: `Requested catalog access for ${user?.email || displayName}`
        })
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        if (res.status === 400 || data.error?.includes('already')) {
          setSent(true)
          toast.info('Request Already Pending', {
            description: 'You already have a pending catalog access request with our team.'
          })
        } else {
          toast.error(data.error || 'Failed to submit access request.')
        }
        return
      }

      setSent(true)
      toast.success('Access Request Sent', {
        description: "Your request has been submitted to the admin team in real-time. We'll notify you once approved."
      })
    } catch (err) {
      toast.error('Failed to send request. Please check network connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-[500px] w-full bg-card border border-border/80 rounded-[28px] p-8 sm:p-12 shadow-elevated text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Soft background ambient gradient glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#F5B52D]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#E59A00]/10 rounded-full blur-3xl pointer-events-none" />

        {/* 80x80 Floating Icon Container */}
        <div className="relative mx-auto mb-8 w-20 h-20 shrink-0 animate-bounce" style={{ animationDuration: '3s' }}>
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#F8C14A] to-[#E09A00] rounded-full blur-lg opacity-40 scale-110" />

          {/* Icon Badge */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#F8C14A] to-[#E09A00] flex items-center justify-center shadow-soft border border-white/20">
            <Lock className="w-9 h-9 text-primary drop-shadow-xs" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-[32px] sm:text-[40px] font-extrabold tracking-tight text-foreground leading-[1.15] mb-4">
          No Products Assigned Yet
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-[360px] mx-auto mb-10">
          Your account doesn&apos;t have access to any catalog yet. Request access to start browsing products and placing bulk orders.
        </p>

        {/* Buttons (Equal 52px height, 14px radius, 16px gap, stacked on mobile) */}
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full mb-8">
          {/* Primary Button */}
          <div className="flex-1 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]">
            <Button
              type="button"
              onClick={handleRequestAccess}
              disabled={submitting || sent}
              className="w-full h-[52px] rounded-[14px] bg-gradient-to-r from-[#F5B52D] to-[#E59A00] hover:from-[#f6bb3c] hover:to-[#eb9f05] text-primary font-extrabold text-sm shadow-soft hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2 border-0 disabled:opacity-80 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Submitting...</span>
                </>
              ) : sent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                  <span>Request Sent</span>
                </>
              ) : (
                <>
                  <span>Request Access</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </Button>
          </div>

          {/* Secondary Button */}
          <div className="flex-1 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full h-[52px] rounded-[14px] bg-card hover:bg-secondary/70 border border-border/80 text-foreground font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
              >
                <MessageCircle className="w-4.5 h-4.5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                <span>Contact Support</span>
              </Button>
            </a>
          </div>
        </div>

        {/* Footer Support Info */}
        <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80">Need immediate access?</span>
          <div className="flex items-center gap-3 font-bold text-foreground">
            <a
              href="mailto:akenterprises1411@gmail.com"
              className="hover:text-primary transition flex items-center gap-1 hover:underline"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Email Support</span>
            </a>
            <span className="text-border">•</span>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 transition hover:underline"
            >
              WhatsApp Support →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
