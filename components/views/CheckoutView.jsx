'use client'
import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MapPin, Tag, CheckCircle, ChevronDown, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function CheckoutView() {
  const { user, cart, cartTotal, clearCart } = useAppContext()
  const router = useRouter()

  const [address, setAddress] = useState({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', gst: '' })
  const [savedAddresses, setSavedAddresses] = useState([])
  const [showAddressPicker, setShowAddressPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isOrdered, setIsOrdered] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null) // { coupon, discount_amount }

  useEffect(() => {
    setMounted(true)
    if (user) {
      setAddress(a => ({ ...a, full_name: user.full_name || '', phone: user.phone || '' }))

      // Fetch saved addresses
      fetch('/api/addresses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(addrs => {
          if (addrs?.length > 0) {
            setSavedAddresses(addrs)
            const defAddr = addrs.find(a => a.is_default) || addrs[0]
            if (defAddr) {
              setAddress({
                id: defAddr.id,
                full_name: defAddr.full_name || '',
                phone: defAddr.phone || '',
                line1: defAddr.line1 || '',
                line2: defAddr.line2 || '',
                city: defAddr.city || '',
                state: defAddr.state || '',
                pincode: defAddr.pincode || '',
                gst: ''
              })
            }
          }
        })
        .catch(err => console.error('Error fetching addresses:', err))
    }
  }, [user])

  if (!mounted) return null

  if (cart.length === 0 && !isOrdered) {
    router.push('/')
    return null
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center slide-up">
        <h2 className="font-display text-3xl font-extrabold mb-2">Sign in to checkout</h2>
        <p className="text-muted-foreground mb-6">Please sign in or create an account.</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/login')} className="flex-1 rounded-full">Sign in</Button>
          <Button onClick={() => router.push('/signup')} variant="outline" className="flex-1 rounded-full">Create account</Button>
        </div>
      </div>
    )
  }

  const shipping = cartTotal > 1999 ? 0 : 99
  const couponDiscount = appliedCoupon?.discount_amount || 0
  const total = cartTotal - couponDiscount + shipping
  
  const totalUnits = cart.reduce((s, i) => s + (i.quantity || 0), 0)
  const minOrderQty = 6000
  const isBelowMOQ = totalUnits < minOrderQty
  const unitsNeeded = minOrderQty - totalUnits

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code: couponCode, order_total: cartTotal })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Invalid coupon')
        return
      }
      setAppliedCoupon(data)
      toast.success(`Coupon applied! You save ${formatINR(data.discount_amount)}`)
    } catch {
      toast.error('Failed to validate coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    toast.success('Coupon removed')
  }

  const selectSavedAddress = (addr) => {
    setAddress({
      id: addr.id,
      full_name: addr.full_name || '',
      phone: addr.phone || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      gst: ''
    })
    setShowAddressPicker(false)
  }

  const placeOrder = async () => {
    if (isBelowMOQ) {
      toast.error(`Minimum order quantity is 6,000 units. You currently have ${totalUnits} units — please add ${unitsNeeded} more units to place an order.`)
      return
    }
    for (const k of ['full_name', 'phone', 'line1', 'city', 'state', 'pincode']) {
      if (!address[k]) { toast.error('Please complete your address'); return }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          items: cart,
          address,
          subtotal: cartTotal,
          shipping_fee: shipping,
          total,
          discount: couponDiscount,
          coupon_code: appliedCoupon?.coupon?.code || null
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Checkout API error:', errData.error || errData)
        const msg = errData.error || 'Unable to place your order. Please check your details and try again.'
        throw new Error(msg)
      }
      const order = await res.json()
      setIsOrdered(true)
      localStorage.setItem('lastOrder', JSON.stringify(order))
      clearCart()
      router.push('/order-success')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 text-left">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-4">Checkout</h1>
      
      {isBelowMOQ && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm">⚠️ Minimum Order Quantity Warning</p>
            <p className="mt-0.5">
              Minimum order quantity is <strong>6,000 units</strong>. You have <strong>{totalUnits.toLocaleString()} units</strong> in your cart. Add <strong>{unitsNeeded.toLocaleString()} more units</strong> to place order.
            </p>
          </div>
          <Button size="sm" onClick={() => router.push('/cart')} variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200 shrink-0 font-bold">
            Add Units
          </Button>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-5">

          {/* Shipping Address */}
          <Card className="radius-lg shadow-soft slide-up">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-extrabold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" /> Shipping Address
                </h3>
                {savedAddresses.length > 0 && (
                  <button
                    onClick={() => setShowAddressPicker(!showAddressPicker)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-full px-3 py-1.5 hover:bg-primary/5 transition"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAddressPicker ? 'rotate-180' : ''}`} />
                    {savedAddresses.length} saved address{savedAddresses.length > 1 ? 'es' : ''}
                  </button>
                )}
              </div>

              {/* Saved address picker */}
              {showAddressPicker && savedAddresses.length > 0 && (
                <div className="mb-5 space-y-2">
                  {savedAddresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => selectSavedAddress(addr)}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition hover:border-primary/50 hover:bg-primary/3 ${address.id === addr.id ? 'border-primary bg-primary/5' : 'border-border/50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{addr.full_name} · {addr.phone}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} — {addr.pincode}</p>
                        </div>
                        {addr.is_default && (
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full shrink-0">Default</span>
                        )}
                      </div>
                    </button>
                  ))}
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground text-center">Or fill in a new address below</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['full_name', 'Full name'],
                  ['phone', 'Phone'],
                  ['line1', 'Address line 1', 'sm:col-span-2'],
                  ['line2', 'Address line 2 (optional)', 'sm:col-span-2'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['pincode', 'Pincode'],
                  ['gst', 'GST Number (optional)']
                ].map(([k, l, cls]) => (
                  <div key={k} className={cls}>
                    <Label className="mb-1.5 text-xs font-semibold">{l}</Label>
                    <Input
                      value={address[k]}
                      onChange={e => setAddress({ ...address, [k]: e.target.value })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="radius-lg shadow-soft slide-up">
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-lg mb-5">Payment Method</h3>
              <label className="flex items-center gap-3 border-2 border-accent rounded-xl p-4 cursor-pointer bg-accent/5">
                <input type="radio" checked readOnly className="accent-accent w-5 h-5" />
                <div>
                  <p className="font-bold">Cash on Delivery</p>
                  <p className="text-sm text-muted-foreground">Pay when your order arrives</p>
                </div>
              </label>
              <p className="text-xs text-muted-foreground mt-3">Card, UPI & Bank Transfer coming soon.</p>
            </CardContent>
          </Card>

          {/* Coupon Code */}
          <Card className="radius-lg shadow-soft slide-up">
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-accent" /> Have a Coupon?
              </h3>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-emerald-700">{appliedCoupon.coupon.code}</p>
                      <p className="text-xs text-emerald-600 font-medium">
                        {appliedCoupon.coupon.discount_type === 'percent'
                          ? `${appliedCoupon.coupon.discount_value}% off`
                          : `₹${appliedCoupon.coupon.discount_value} flat off`
                        } — You save {formatINR(appliedCoupon.discount_amount)}
                      </p>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    placeholder="Enter coupon code"
                    className="h-11 rounded-xl font-mono tracking-widest uppercase flex-1"
                  />
                  <Button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="h-11 rounded-xl px-5 shrink-0"
                    variant="outline"
                  >
                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <Card className="h-fit slide-in-right radius-lg shadow-soft sticky top-24">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-display font-extrabold text-xl">Order Summary</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {cart.map(i => (
                <div key={i.product_id} className="flex gap-2 text-sm">
                  <Image src={i.image || '/placeholder.png'} width={48} height={56} className="w-12 h-14 object-cover rounded-lg" alt="" loading="lazy" />
                  <div className="flex-1">
                    <p className="line-clamp-1 text-xs font-medium">{i.product_name_snapshot}</p>
                    <p className="text-muted-foreground text-xs">Qty {i.quantity}</p>
                  </div>
                  <p className="font-semibold text-xs">{formatINR(i.price_snapshot * i.quantity)}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatINR(cartTotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Coupon Discount
                </span>
                <span className="text-emerald-600 font-bold">−{formatINR(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">{shipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : formatINR(shipping)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-display font-extrabold text-xl">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
            {couponDiscount > 0 && (
              <p className="text-xs text-center text-emerald-600 font-semibold bg-emerald-500/8 rounded-lg py-1.5">
                🎉 You're saving {formatINR(couponDiscount)} on this order!
              </p>
            )}
            <Button
              onClick={(e) => { addRipple(e); placeOrder() }}
              disabled={loading || isBelowMOQ}
              className="w-full rounded-full h-12 btn-shine ripple font-semibold disabled:opacity-50"
              size="lg"
            >
              {loading ? <><span className="btn-spinner mr-2" />Placing order...</> : (isBelowMOQ ? 'MOQ (6,000 units) Required' : 'Place Order')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
