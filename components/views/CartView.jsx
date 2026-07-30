'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShoppingBag, ArrowRight, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAppContext } from '@/components/providers/AppProvider'
import { validateCategoryMinOrderValues } from '@/lib/gst-utils'

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

function CartQuantityInput({ item, onUpdateQty, onRemove }) {
  const [val, setVal] = useState(String(item.quantity))

  useEffect(() => {
    setVal(String(item.quantity))
  }, [item.quantity])

  const handleChange = (e) => {
    const raw = e.target.value
    setVal(raw)

    if (raw === '') return

    const num = parseInt(raw, 10)
    if (isNaN(num)) return

    if (num < 0) {
      toast.error('Quantity cannot be negative')
      setVal(String(item.quantity))
      return
    }

    if (item.stock_quantity !== undefined && item.stock_quantity !== null && num > item.stock_quantity) {
      toast.error(`Only ${item.stock_quantity.toLocaleString()} units available in stock`)
      setVal(String(item.stock_quantity))
      onUpdateQty(item.product_id, item.stock_quantity)
      return
    }

    if (num === 0) {
      if (window.confirm(`Remove "${item.product_name_snapshot || 'this item'}" from cart?`)) {
        onRemove(item.product_id)
      } else {
        setVal(String(item.quantity || 1))
        onUpdateQty(item.product_id, item.quantity || 1)
      }
      return
    }

    onUpdateQty(item.product_id, num)
  }

  const handleBlur = () => {
    if (!val || parseInt(val, 10) <= 0 || isNaN(parseInt(val, 10))) {
      setVal(String(item.quantity || 1))
      onUpdateQty(item.product_id, item.quantity || 1)
    }
  }

  return (
    <div className="flex items-center border rounded-2xl overflow-hidden bg-background shadow-xs">
      <button
        onClick={() => {
          if (item.quantity <= 1) {
            if (window.confirm(`Remove "${item.product_name_snapshot || 'this item'}" from cart?`)) {
              onRemove(item.product_id)
            }
          } else {
            onUpdateQty(item.product_id, item.quantity - 1)
          }
        }}
        className="p-2 sm:p-2.5 hover:bg-secondary transition shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Decrease quantity"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={val}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-16 sm:w-24 text-center font-extrabold text-sm sm:text-base bg-transparent border-0 focus:outline-none focus:ring-0 p-1 text-foreground font-mono"
        aria-label="Item quantity"
      />

      <button
        onClick={() => {
          if (item.stock_quantity !== undefined && item.stock_quantity !== null && item.quantity >= item.stock_quantity) {
            toast.error(`Only ${item.stock_quantity.toLocaleString()} units available in stock`)
            return
          }
          onUpdateQty(item.product_id, item.quantity + 1)
        }}
        className="p-2 sm:p-2.5 hover:bg-secondary transition shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Increase quantity"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function CartView() {
  const { cart, cartTotal, updateQty, removeItem } = useAppContext()
  const router = useRouter()
  const [categories, setCategories] = useState([])

  // Fetch categories to get min_order_value per category
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(cats => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => {})
  }, [])

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

  // Validate per-category minimum order values
  const movViolations = validateCategoryMinOrderValues(cart, categories)
  const hasMOVViolation = movViolations.length > 0

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">Shopping Cart</h1>

      {/* Per-Category Minimum Order Value Warnings */}
      {hasMOVViolation && (
        <div className="mb-8 space-y-3">
          {movViolations.map((v, i) => (
            <div key={i} className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">⚠️ Category Minimum Order Value Required</p>
                  <p className="mt-0.5">
                    <strong>{v.categoryName} items:</strong> {formatINR(v.currentValue)} of {formatINR(v.minValue)} required — add <strong>{formatINR(v.shortage)}</strong> more
                  </p>
                </div>
              </div>
              <Link href={`/products?category=${v.categoryName.toLowerCase().replace(/\s+/g, '-')}`}>
                <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200 shrink-0 font-bold whitespace-nowrap">
                  Add More
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((i, idx) => (
            <Card key={i.product_id} className="radius-lg shadow-soft card-lift" style={{ animationDelay: `${idx * 60}ms` }}>
              <CardContent className="pt-4 flex gap-3 sm:gap-4">
                <Image src={i.image} width={96} height={128} className="w-20 sm:w-24 h-28 sm:h-32 object-cover rounded-xl shrink-0" alt={i.product_name_snapshot} loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-sm sm:text-base leading-tight line-clamp-2">{i.product_name_snapshot}</p>
                    <p className="font-display font-extrabold text-base sm:text-xl whitespace-nowrap shrink-0">{formatINR(i.price_snapshot * i.quantity)}</p>
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1">{formatINR(i.price_snapshot)} / unit</p>

                  <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4">
                    <CartQuantityInput item={i} onUpdateQty={updateQty} onRemove={removeItem} />

                    <button onClick={() => removeItem(i.product_id)} className="text-xs sm:text-sm text-muted-foreground hover:text-destructive flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />Remove
                    </button>
                  </div>
                </div>
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
            {hasMOVViolation && (
              <p className="text-xs text-amber-600 font-semibold text-center bg-amber-500/10 rounded-xl p-2">
                Meet category minimums above to checkout
              </p>
            )}
            <Button
              onClick={(e) => { addRipple(e); router.push('/checkout') }}
              disabled={hasMOVViolation}
              className="w-full rounded-full h-12 btn-shine ripple font-semibold disabled:opacity-50"
            >
              {hasMOVViolation ? 'Category Minimum Required' : <><span>Proceed to Checkout</span> <ArrowRight className="ml-1 w-4 h-4" /></>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
