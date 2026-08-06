'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { MapPin, ChevronDown, CheckCircle2, ArrowRight, Eye, AlertTriangle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getStatusLabel } from '@/lib/status-labels'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppContext } from '@/components/providers/AppProvider'
import { INDIAN_STATES } from '@/lib/constants/indian-states'
import { calculateCartGST, validateCategoryMinOrderValues } from '@/lib/gst-utils'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const getStateFromPincode = (pincode) => {
  if (!pincode || pincode.length < 2) return null
  const prefix = pincode.slice(0, 2)
  if (prefix === '11') return 'Delhi'
  if (['12', '13'].includes(prefix)) return 'Haryana'
  if (['14', '15'].includes(prefix)) return 'Punjab'
  if (prefix === '16') return 'Chandigarh'
  if (prefix === '17') return 'Himachal Pradesh'
  if (['18', '19'].includes(prefix)) return 'Jammu & Kashmir'
  if (['20', '21', '22', '23', '24', '25', '26', '27', '28'].includes(prefix)) return 'Uttar Pradesh'
  if (['30', '31', '32', '33', '34'].includes(prefix)) return 'Rajasthan'
  if (['36', '37', '38', '39'].includes(prefix)) return 'Gujarat'
  if (['40', '41', '42', '43', '44'].includes(prefix)) return 'Maharashtra'
  if (['45', '46', '47', '48'].includes(prefix)) return 'Madhya Pradesh'
  if (prefix === '49') return 'Chhattisgarh'
  if (['50', '51', '52', '53'].includes(prefix)) return 'Andhra Pradesh'
  if (['56', '57', '58', '59'].includes(prefix)) return 'Karnataka'
  if (['60', '61', '62', '63', '64'].includes(prefix)) return 'Tamil Nadu'
  if (['67', '68', '69'].includes(prefix)) return 'Kerala'
  if (['70', '71', '72', '73', '74'].includes(prefix)) return 'West Bengal'
  if (['75', '76', '77'].includes(prefix)) return 'Odisha'
  if (prefix === '78') return 'Assam'
  if (['80', '81', '82', '83', '84', '85'].includes(prefix)) return 'Bihar'
  return null
}

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
  const [categories, setCategories] = useState([])
  const [supplierState, setSupplierState] = useState('Maharashtra')

  useEffect(() => {
    setMounted(true)

    // Load categories for MOV validation
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(cats => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => {})

    // Load settings for supplier_state
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then(s => { if (s?.supplier_state) setSupplierState(s.supplier_state) })
      .catch(() => {})

    if (user) {
      setAddress(a => ({ ...a, full_name: user.full_name || '', phone: user.phone || '', gst: user.gst_number || '' }))

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
                gst: defAddr.gst || user.gst_number || ''
              })
            }
          }
        })
        .catch(err => console.error('Error fetching addresses:', err))
    }
  }, [user])

  // ── ALL HOOKS AND DERIVED VALUES MUST BE ABOVE ANY EARLY RETURNS ────────────
  // React Rules of Hooks: hooks (useMemo) must always be called in the same
  // order every render — never conditionally. We compute everything here with
  // safe fallbacks and only return early AFTER this block.

  const shipping = (cartTotal || 0) > 1999 ? 0 : 99

  // Per-category MOV validation (safe: validateCategoryMinOrderValues handles empty arrays)
  const movViolations = validateCategoryMinOrderValues(cart || [], categories)
  const hasMOVViolation = movViolations.length > 0

  // GST breakdown — safe fallback so it always runs even with empty cart
  const gstBreakdown = calculateCartGST(
    (cart || []).map(i => ({
      ...i,
      price_snapshot: i.price_snapshot || 0,
      quantity: i.quantity || 1,
      gst_percent: (i.gst_percent !== undefined && i.gst_percent !== null) ? i.gst_percent : 18,
      hsn_code: i.hsn_code || '',
      product_name_snapshot: i.product_name_snapshot || '',
    })),
    address.state || '',
    supplierState || 'Maharashtra'
  )

  // Destructure for direct JSX use — defaults prevent undefined reference errors
  const {
    sameState = false,
    totalTaxable = 0,
    totalCGST = 0,
    totalSGST = 0,
    totalIGST = 0,
  } = gstBreakdown || {}

  // useMemo MUST be here — before any conditional returns — to satisfy Rules of Hooks
  const pincodeStateWarning = useMemo(() => {
    if (!address.pincode || address.pincode.length < 6 || !address.state) return null
    const detected = getStateFromPincode(address.pincode)
    if (detected && detected.toLowerCase() !== address.state.toLowerCase()) {
      if (detected === 'Andhra Pradesh' && address.state === 'Telangana') return null
      if (detected === 'Uttar Pradesh' && address.state === 'Uttarakhand') return null
      return `Pincode ${address.pincode} typically belongs to ${detected} — please confirm your state selection.`
    }
    return null
  }, [address.pincode, address.state])

  const total = (cartTotal || 0) + shipping

  // ── EARLY RETURNS — only after all hooks are called ───────────────────────
  if (!mounted) return null

  if ((cart || []).length === 0 && !isOrdered) {
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
      gst: addr.gst || ''
    })
    setShowAddressPicker(false)
  }

  const placeOrder = async () => {
    if (hasMOVViolation) {
      const msgs = movViolations.map(v => `${v.categoryName}: add ${formatINR(v.shortage)} more`).join('; ')
      toast.error(`Category minimum not met — ${msgs}`)
      return
    }
    for (const k of ['full_name', 'phone', 'line1', 'city', 'state', 'pincode']) {
      if (!address[k]) { toast.error('Please complete your address'); return }
    }
    setLoading(true)
    console.log('[Checkout Submit] Sending Address:', address)
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
          discount: 0,
          gst_breakdown: gstBreakdown
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

      {/* Per-Category MOV Warnings */}
      {hasMOVViolation && (
        <div className="mb-6 space-y-2">
          {movViolations.map((v, i) => (
            <div key={i} className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">⚠️ Category Minimum Order Value Required</p>
                  <p className="mt-0.5">
                    <strong>{v.categoryName} items:</strong> {formatINR(v.currentValue)} of {formatINR(v.minValue)} required — add <strong>{formatINR(v.shortage)}</strong> more
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => router.push('/cart')} variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200 shrink-0 font-bold">
                Go to Cart
              </Button>
            </div>
          ))}
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
                  ['pincode', 'Pincode'],
                  ['gst', 'GST Number (optional)'],
                ].map(([k, l, cls]) => (
                  <div key={k} className={cls}>
                    <Label className="mb-1.5 text-xs font-semibold">{l}</Label>
                    <Input
                      value={address[k]}
                      onChange={e => {
                        const val = e.target.value
                        const updates = { [k]: val, id: undefined }
                        if (k === 'pincode') {
                          if (val.length === 6) {
                            const detected = getStateFromPincode(val)
                            if (detected) updates.state = detected
                          }
                        }
                        setAddress(prev => ({ ...prev, ...updates }))
                      }}
                      className="h-11 rounded-xl"
                    />
                  </div>
                ))}

                {/* State Dropdown — Indian States */}
                <div>
                  <Label className="mb-1.5 text-xs font-semibold">State *</Label>
                  <Select value={address.state} onValueChange={v => setAddress(prev => ({ ...prev, state: v, id: undefined }))}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {INDIAN_STATES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pincodeStateWarning && (
                <div className="mt-4 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-2 bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 animate-pulse">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                  <span>{pincodeStateWarning}</span>
                </div>
              )}

              {/* GST Type Badge */}
              {address.state && (
                <div className={`mt-4 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2 ${sameState ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'}`}>
                  <span className={`w-2 h-2 rounded-full ${sameState ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  {sameState
                    ? `Intra-state supply (${address.state}) — CGST + SGST applies`
                    : `Inter-state supply (${address.state} ← ${supplierState}) — IGST applies`
                  }
                </div>
              )}
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

            {/* Price Breakdown */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable Value</span>
                <span className="font-medium">{formatINR(totalTaxable)}</span>
              </div>

              {/* GST Breakdown */}
              {address.state ? (
                sameState ? (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>CGST (incl.)</span>
                      <span>{formatINR(totalCGST)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>SGST (incl.)</span>
                      <span>{formatINR(totalSGST)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>IGST (incl.)</span>
                    <span>{formatINR(totalIGST)}</span>
                  </div>
                )
              ) : (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST (select state to split)</span>
                  <span className="italic">—</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping Logistics</span>
                <span className="font-medium">{shipping === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : formatINR(shipping)}</span>
              </div>
            </div>

            <Separator />
            <div className="flex justify-between font-display font-extrabold text-xl">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
            <Button
              onClick={(e) => { addRipple(e); placeOrder() }}
              disabled={loading || hasMOVViolation}
              className="w-full rounded-full h-12 btn-shine ripple font-semibold disabled:opacity-50 mt-2"
              size="lg"
            >
              {loading ? <><span className="btn-spinner mr-2" />Placing order...</> : hasMOVViolation ? 'Category Minimum Required' : 'Place Order'}
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
                  <span className="font-bold capitalize text-amber-600">{getStatusLabel(lastOrderData.status || 'pending')}</span>
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
