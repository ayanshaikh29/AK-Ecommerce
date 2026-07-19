'use client'
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShoppingBag, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

function addRipple(e) {
  const btn = e.currentTarget; if (!btn) return
  const rect = btn.getBoundingClientRect()
  const r = document.createElement('span')
  const size = Math.max(rect.width, rect.height)
  r.className = 'ripple-el'
  r.style.width = r.style.height = size + 'px'
  r.style.left = (e.clientX - rect.left - size / 2) + 'px'
  r.style.top = (e.clientY - rect.top - size / 2) + 'px'
  btn.appendChild(r)
  setTimeout(() => r.remove(), 600)
}

export function CartView() {
  const { cart, cartTotal, updateQty, removeItem } = useAppContext()
  const router = useRouter()

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24 px-4 slide-up">
        <div className="w-20 h-20 mx-auto rounded-full bg-secondary flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-3xl font-extrabold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Discover our B2B catalog</p>
        <Link href="/products">
          <Button size="lg" className="rounded-full btn-shine">Browse Products</Button>
        </Link>
      </div>
    )
  }

  const shipping = cartTotal > 1999 ? 0 : 99

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-8">Shopping Cart</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((i, idx) => (
            <Card key={i.product_id} className="radius-lg shadow-soft card-lift" style={{ animationDelay: `${idx * 60}ms` }}>
              <CardContent className="pt-4 flex gap-4">
                <Image src={i.image} width={96} height={128} className="w-24 h-32 object-cover rounded-xl" alt={i.product_name_snapshot} loading="lazy" />
                <div className="flex-1">
                  <p className="font-semibold">{i.product_name_snapshot}</p>
                  <p className="text-muted-foreground text-sm">{formatINR(i.price_snapshot)}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center border rounded-full">
                      <button onClick={() => updateQty(i.product_id, i.quantity - 1)} className="p-2"><Minus className="w-3 h-3" /></button>
                      <span className="px-3 font-semibold">{i.quantity}</span>
                      <button onClick={() => updateQty(i.product_id, i.quantity + 1)} className="p-2"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => removeItem(i.product_id)} className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1">
                      <Trash2 className="w-4 h-4" />Remove
                    </button>
                  </div>
                </div>
                <p className="font-display font-extrabold text-xl">{formatINR(i.price_snapshot * i.quantity)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-fit slide-in-right radius-lg shadow-soft sticky top-24">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-display font-extrabold text-2xl">Order Summary</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatINR(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{shipping === 0 ? <span className="text-accent font-bold">FREE</span> : formatINR(shipping)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-display font-extrabold text-2xl">
              <span>Total</span>
              <span>{formatINR(cartTotal + shipping)}</span>
            </div>
            <Button onClick={(e) => { addRipple(e); router.push('/checkout') }} className="w-full rounded-full h-12 btn-shine ripple font-semibold">
              Proceed to Checkout <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
