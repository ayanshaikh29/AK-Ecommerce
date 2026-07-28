'use client'

import React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShoppingBag, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartToast } from '@/components/providers/CartToastProvider'

export function AddToCartToastContainer() {
  const { toasts, dismissToast, pauseToast, resumeToast } = useCartToast()
  const router = useRouter()

  if (!toasts || toasts.length === 0) return null

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full px-4 sm:px-0 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toastItem) => {
        const { id, product, quantity } = toastItem
        const imgUrl = product.image || product.images?.[0] || '/placeholder-product.png'
        const productName = product.name || product.product_name_snapshot || 'Product'
        const price = product.price || product.price_snapshot || 0

        return (
          <div
            key={id}
            onMouseEnter={() => pauseToast(id)}
            onMouseLeave={() => resumeToast(id)}
            className="pointer-events-auto bg-card/95 backdrop-blur-md border border-border/80 text-card-foreground rounded-2xl p-4 shadow-elevated transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in zoom-in-95 hover:shadow-2xl group relative overflow-hidden"
          >
            {/* Top Emerald Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-2xl" />

            <div className="flex items-start gap-3">
              {/* Green Success Badge Icon */}
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              {/* Product Thumbnail */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-secondary border border-border/60 shrink-0">
                <Image
                  src={imgUrl}
                  alt={productName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Title & Details */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Added to Cart Successfully
                  </span>
                </div>
                <h4 className="font-display font-extrabold text-sm text-foreground line-clamp-1">
                  {productName}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">Qty: {quantity}</span>
                  <span>•</span>
                  <span className="font-extrabold text-accent">₹{Number(price * quantity).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => dismissToast(id)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismissToast(id)}
                className="flex-1 rounded-xl text-xs font-semibold h-9 border-border/70 hover:bg-secondary"
              >
                Continue Shopping
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  dismissToast(id)
                  router.push('/cart')
                }}
                className="flex-1 rounded-xl text-xs font-bold h-9 gold-gradient text-primary shadow-soft hover:shadow-glow transition-all"
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                Go to Cart
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
