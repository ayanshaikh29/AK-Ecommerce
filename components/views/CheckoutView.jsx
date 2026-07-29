'use client'
import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { MapPin, ChevronDown, CheckCircle2, ArrowRight, Eye } from 'lucide-react'
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
  const [lastOrderData, setLastOrderData] = useState(null)
  const [mounted, setMounted] = useState(false)

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
        <p className="text-muted-foreground mb-6">Please log in with your assigned AK Enterprises credentials to place your order.</p>
        <Button onClick={() => router.push('/login')} className="w-full rounded-full h-12 font-semibold">Sign in to Account</Button>
      </div>
    )
  }

  const shipping = cartTotal > 1999 ? 0 : 99
  const total = cartTotal + shipping
  
  const totalUnits = cart.reduce((s, i) => s + (i.quantity || 0), 0)
  const minOrderQty = 6000
  const isBelowMOQ = totalUnits < minOrderQty
  const unitsNeeded = minOrderQty - totalUnits

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
          discount: 0
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
      setLastOrderData(order)
      localStorage.setItem('lastOrder', JSON.stringify(order))
      clearCart()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 text-left">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-6">Checkout</h1>
      
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
        <div className="lg:col-span-2 space-y-6">

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
                  <p className="font-bold text-foreground">Cash on Delivery / Corporate Credit Terms</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pay upon delivery or per your agreed corporate billing cycle</p>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <Card className="h-fit slide-in-right radius-lg shadow-soft sticky top-24">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-display font-extrabold text-xl">Order Summary</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {cart.map(i => (
                <div key={i.product_id} className="flex gap-2 text-sm items-center">
                  <Image src={i.image || '/placeholder.png'} width={48} height={56} className="w-12 h-14 object-cover rounded-lg shrink-0" alt="" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1 text-xs font-medium">{i.product_name_snapshot}</p>
                    <p className="text-muted-foreground text-xs">Qty {i.quantity}</p>
                  </div>
                  <p className="font-semibold text-xs shrink-0">{formatINR(i.price_snapshot * i.quantity)}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatINR(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping Logistics</span>
              <span className="font-medium">{shipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : formatINR(shipping)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-display font-extrabold text-xl">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
            <Button
              onClick={(e) => { addRipple(e); placeOrder() }}
              disabled={loading || isBelowMOQ}
              className="w-full rounded-full h-12 btn-shine ripple font-semibold disabled:opacity-50 mt-2"
              size="lg"
            >
              {loading ? <><span className="btn-spinner mr-2" />Placing order...</> : (isBelowMOQ ? 'MOQ (6,000 units) Required' : 'Place Order')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Order Success Modal */}
      <AnimatePresence>
        {isOrdered && lastOrderData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-card border border-border/80 rounded-3xl p-8 md:p-10 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
            >
              <div className="w-20 h-20 gold-gradient rounded-full flex items-center justify-center mx-auto mb-6 pulse-glow shadow-glow">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>

              <h2 className="font-display text-3xl font-extrabold mb-2">Order Placed!</h2>
              <p className="text-muted-foreground mb-6">Your order has been submitted successfully.</p>

              <div className="bg-secondary/30 rounded-2xl p-5 mb-6 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-bold font-mono text-foreground">#{lastOrderData.order_number || lastOrderData.id?.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-foreground">{formatINR(lastOrderData.total || lastOrderData.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-bold capitalize text-amber-600">{(lastOrderData.status || 'pending').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Processing</span>
                  <span className="font-bold text-foreground">24-48 hours</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Link href={lastOrderData.id ? `/orders/${lastOrderData.id}` : '/orders'} className="w-full">
                  <Button className="w-full rounded-full h-12 gold-gradient text-primary font-bold shadow-glow">
                    <Eye className="w-4 h-4 mr-2" /> Track Order
                  </Button>
                </Link>
                <Link href="/customer/dashboard">
                  <Button variant="outline" className="w-full rounded-full h-12 font-semibold border-border">
                    <ArrowRight className="w-4 h-4 mr-2" /> Go to Dashboard
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
