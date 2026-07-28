'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, User, CreditCard, X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AdminToastFeed({ activePopup, onDismiss }) {
  const router = useRouter()

  if (!activePopup) return null

  const { id, order_number, customerName, total, eventType = 'order' } = activePopup

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 sm:px-0 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-card/95 backdrop-blur-md border border-border/80 text-card-foreground rounded-2xl p-4 shadow-elevated overflow-hidden group relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-2xl" />

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
            {eventType === 'order' ? (
              <ShoppingBag className="w-5 h-5" />
            ) : eventType === 'payment' ? (
              <CreditCard className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {eventType === 'order' ? 'New Order Received' : eventType === 'payment' ? 'Payment Proof Uploaded' : 'Customer Activity'}
              </span>
            </div>
            <h4 className="font-display font-extrabold text-sm text-foreground">
              {eventType === 'order' ? `Order #${order_number}` : customerName}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer: <span className="font-semibold text-foreground">{customerName}</span>
            </p>
            {total && (
              <p className="text-xs font-extrabold text-primary mt-0.5">
                Amount: ₹{Number(total).toLocaleString('en-IN')}
              </p>
            )}
          </div>

          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            className="flex-1 rounded-xl text-xs font-semibold h-9"
          >
            Dismiss
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onDismiss()
              if (eventType === 'order' && id) {
                router.push(`/admin/orders/${id}`)
              } else {
                router.push('/admin/customers')
              }
            }}
            className="flex-1 rounded-xl text-xs font-bold h-9 gold-gradient text-primary shadow-soft"
          >
            {eventType === 'order' ? 'Open Order' : 'View Customer'}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
