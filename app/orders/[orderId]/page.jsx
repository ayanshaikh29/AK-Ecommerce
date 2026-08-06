'use client'
import React, { useState, useEffect, Component } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, Loader2, Calendar, FileText, MapPin,
  CreditCard, CheckCircle2, Truck, Package, ExternalLink,
  XCircle, RotateCcw, AlertCircle, X, ShieldAlert, FileDown
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '@/components/providers/AppProvider'
import { getStatusLabel } from '@/lib/status-labels'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

// ─── Client error logger ─────────────────────────────────────────────────────
function logClientError(error, context = '') {
  try {
    const payload = {
      message: error?.message || String(error) || 'Unknown error',
      stack: error?.stack || '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      context,
      timestamp: new Date().toISOString()
    }
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''}` },
      body: JSON.stringify(payload)
    }).catch(() => {}) // fire-and-forget, never crash
  } catch (_) {}
}

// ─── GST helper ──────────────────────────────────────────────────────────────
const SUPPLIER_STATE = 'maharashtra'
function computeGST(items, customerState) {
  const st = (customerState || '').toLowerCase().trim()
  const sameState = st === SUPPLIER_STATE || st === 'mh'
  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0
  ;(items || []).forEach(it => {
    const rate = Number(it?.price_snapshot || 0)
    const qty = Number(it?.quantity || 0)
    const gstPct = Number(it?.products?.gst_percent ?? it?.gst_percent ?? 18)
    const basePrice = rate * qty / (1 + gstPct / 100)
    const taxAmt = rate * qty - basePrice
    totalTaxable += basePrice
    if (sameState) {
      totalCGST += taxAmt / 2
      totalSGST += taxAmt / 2
    } else {
      totalIGST += taxAmt
    }
  })
  return { sameState, totalTaxable, totalCGST, totalSGST, totalIGST }
}

const TIMELINE_STEPS = [
  { key: 'placed', label: 'Order Placed', description: 'Your B2B purchase order has been received.' },
  { key: 'pending_vendor_acceptance', label: 'Awaiting Zonal Admin Acceptance', description: 'Your assigned zonal admin must review and accept the order.', optional: true },
  { key: 'vendor_accepted_pending_admin_approval', label: 'Zonal Admin Accepted — Pending Owner Approval', description: 'Zonal admin accepted — awaiting Owner final confirmation.', optional: true },
  { key: 'pending_admin_approval', label: 'Awaiting Owner Approval', description: 'Order sent directly to Owner for approval (no zonal admin assigned).', optional: true },
  { key: 'confirmed', label: 'Confirmed by AK Enterprises', description: 'Order reviewed and confirmed by AK Enterprises. Processing has begun.' },
  { key: 'packed', label: 'Packed', description: 'Order items packed and labeled for dispatch.' },
  { key: 'shipped', label: 'Shipped', description: 'Dispatched via logistics carrier.' },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'Out with delivery executive for arrival.' },
  { key: 'delivered', label: 'Delivered', description: 'Order delivered successfully.' }
]

// ─── Granular Error Boundary ─────────────────────────────────────────────────
// A self-contained class component — no external package needed.
// Wraps each card section independently: if one crashes, only that card
// shows a fallback alert; the rest of the page keeps rendering normally.
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    logClientError(error, `SectionErrorBoundary[${this.props.sectionName || 'unknown'}]: ${info?.componentStack?.slice(0, 200) || ''}`)
    console.error(`[SectionErrorBoundary] Section "${this.props.sectionName}" crashed:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="text-sm font-bold">Unable to load this section</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {this.props.sectionName ? `"${this.props.sectionName}" encountered an error.` : 'A section encountered an error.'} Other parts of the page are unaffected.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 text-xs font-semibold underline underline-offset-2 hover:text-amber-800 transition"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrderDetailsPage() {
  const { user } = useAppContext()
  const router = useRouter()
  const params = useParams()
  const orderId = params?.orderId

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Cancel / Return state
  const [cancelLoading, setCancelLoading] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnDetails, setReturnDetails] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)

  const fetchOrderDetails = async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error || 'Order not found')
      }
      const data = await res.json()
      setOrder(data)
    } catch (err) {
      logClientError(err, 'fetchOrderDetails')
      toast.error(err?.message || 'Failed to load order details')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadInvoice = async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
      const res = await fetch(`/api/orders/${orderId}/invoice-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to download invoice')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${order?.order_number || orderId}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      logClientError(err, 'handleDownloadInvoice')
      toast.error(err?.message || 'Invoice download failed')
    }
  }

  const handleDownloadChallan = async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
      const res = await fetch(`/api/orders/${orderId}/challan-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to download challan')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `challan-${order?.order_number || orderId}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      logClientError(err, 'handleDownloadChallan')
      toast.error(err?.message || 'Challan download failed')
    }
  }

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    setCancelLoading(true)
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cancelled' })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error || 'Failed to cancel order')
      }
      setOrder(prev => ({ ...prev, status: 'cancelled' }))
      toast.success('Order cancelled successfully')
    } catch (err) {
      logClientError(err, 'handleCancelOrder')
      toast.error(err?.message || 'Cancellation failed. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleReturnRequest = async () => {
    if (!returnReason) { toast.error('Please select a reason'); return }
    setReturnLoading(true)
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
      const res = await fetch('/api/return-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId, reason: returnReason, details: returnDetails })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error || 'Failed to submit return request')
      }
      setOrder(prev => ({ ...prev, status: 'returned' }))
      setShowReturnModal(false)
      toast.success('Return request submitted! We will contact you within 24 hours.')
    } catch (err) {
      logClientError(err, 'handleReturnRequest')
      toast.error(err?.message || 'Return request failed. Please try again.')
    } finally {
      setReturnLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    if (mounted && !user) {
      router.push(`/login?redirect=/orders/${orderId}`)
      return
    }
    if (user && orderId) {
      fetchOrderDetails()
    }
  }, [user, orderId, mounted])

  // Poll for status updates every 10 seconds
  useEffect(() => {
    if (!user || !orderId) return
    const interval = setInterval(() => {
      fetchOrderDetails()
    }, 10000)
    return () => clearInterval(interval)
  }, [user, orderId])

  if (!mounted || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!order) return null

  // ── Safely derive values ──────────────────────────────────────────────────
  const orderStatus = (order?.status || 'pending').toLowerCase()
  const orderNumber = order?.order_number || order?.id?.slice(0, 8) || '—'
  const orderAddress = order?.address || {}                    // already object from backend
  const orderItems = Array.isArray(order?.items) ? order.items : []
  const statusHistory = Array.isArray(order?.status_history) ? order.status_history : []

  const activeStepIdx = TIMELINE_STEPS.findIndex(step => step.key === orderStatus)
  const currentStep = activeStepIdx !== -1 ? activeStepIdx : 0

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Order Details</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Order Number: <span className="font-mono font-bold text-foreground">{orderNumber}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleDownloadInvoice}
            variant="outline"
            size="sm"
            className="rounded-full h-9 px-4 flex items-center gap-2 shadow-sm border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5 font-semibold"
          >
            <FileText className="w-4 h-4" /> Download Tax Invoice
          </Button>
          <Button
            onClick={handleDownloadChallan}
            variant="outline"
            size="sm"
            className="rounded-full h-9 px-4 flex items-center gap-2 shadow-sm border-blue-500/30 text-blue-600 hover:bg-blue-500/5 font-semibold"
          >
            <FileDown className="w-4 h-4" /> Download Challan
          </Button>

          {['pending', 'confirmed'].includes(orderStatus) && (
            <Button
              onClick={handleCancelOrder}
              disabled={cancelLoading}
              variant="outline"
              size="sm"
              className="rounded-full h-9 px-4 flex items-center gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <XCircle className="w-4 h-4" />
              {cancelLoading ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          )}
          {orderStatus === 'delivered' && (
            <Button
              onClick={() => setShowReturnModal(true)}
              variant="outline"
              size="sm"
              className="rounded-full h-9 px-4 flex items-center gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/5"
            >
              <RotateCcw className="w-4 h-4" /> Request Return
            </Button>
          )}
        </div>
      </div>

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowReturnModal(false)}>
          <div className="bg-background rounded-2xl shadow-elevated w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-extrabold text-xl flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" /> Return Request
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 text-xs font-semibold">Reason for Return *</Label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border/80 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a reason...</option>
                  <option value="Wrong product received">Wrong product received</option>
                  <option value="Damaged or defective product">Damaged or defective product</option>
                  <option value="Product not as described">Product not as described</option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label className="mb-2 text-xs font-semibold">Additional Details</Label>
                <Textarea
                  value={returnDetails}
                  onChange={e => setReturnDetails(e.target.value)}
                  placeholder="Please describe the issue in detail..."
                  className="rounded-xl"
                  rows={3}
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Return requests are reviewed within 24 hours. A pickup will be arranged once approved.</p>
              </div>
              <Button
                onClick={handleReturnRequest}
                disabled={returnLoading || !returnReason}
                className="w-full rounded-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                {returnLoading ? 'Submitting...' : 'Submit Return Request'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* ── Shipping Address Card ── wrapped in its own boundary */}
        <SectionErrorBoundary sectionName="Shipping Address">
          <Card className="md:col-span-2 border border-border/40 bg-card/50 radius-lg">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-accent" /> Shipping Address
              </h3>
              {orderAddress?.line1 ? (
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="font-bold text-foreground">{orderAddress?.full_name || '—'}</p>
                  <p className="font-semibold text-foreground/80">{orderAddress?.phone || ''}</p>
                  <p>{orderAddress?.line1 || ''}</p>
                  {orderAddress?.line2 && orderAddress.line2 !== orderAddress.line1 && (
                    <p>{orderAddress.line2}</p>
                  )}
                  <p>
                    {[orderAddress?.city, orderAddress?.state].filter(Boolean).join(', ')}
                    {orderAddress?.pincode ? ` - ` : ''}
                    {orderAddress?.pincode && <span className="font-semibold text-foreground">{orderAddress.pincode}</span>}
                  </p>
                  {orderAddress?.gst && (
                    <p className="text-xs text-muted-foreground pt-1">
                      GSTIN: <span className="font-mono font-semibold text-foreground">{orderAddress.gst}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Address details not available</p>
              )}
            </CardContent>
          </Card>
        </SectionErrorBoundary>

        {/* ── Bill Details Card ── wrapped in its own boundary */}
        <SectionErrorBoundary sectionName="Bill Details">
          <Card className="border border-border/40 bg-card/50 radius-lg">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent" /> Bill Details
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Price</span>
                    <span className="font-medium text-foreground">{formatINR(order?.subtotal)}</span>
                  </div>
                  {(order?.discount || 0) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discounts</span>
                      <span className="font-medium text-destructive">-{formatINR(order?.discount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping Fee</span>
                    <span className="font-medium text-foreground">
                      {(order?.shipping_fee || 0) > 0 ? formatINR(order.shipping_fee) : 'FREE'}
                    </span>
                  </div>
                  {/* GST Breakdown — safe computed from items + address */}
                  {(() => {
                    try {
                      const customerState = orderAddress?.state || ''
                      const gst = computeGST(orderItems, customerState)
                      const hasGST = gst.totalCGST > 0 || gst.totalSGST > 0 || gst.totalIGST > 0
                      if (!hasGST) return null
                      return (
                        <div className="pt-2 mt-1 border-t border-border/20 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            GST Breakdown ({gst.sameState ? 'Intra-state' : 'Inter-state'})
                          </p>
                          {gst.sameState ? (
                            <>
                              <div className="flex justify-between text-muted-foreground">
                                <span>CGST (incl. in price)</span>
                                <span className="font-medium">{formatINR(gst.totalCGST)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>SGST (incl. in price)</span>
                                <span className="font-medium">{formatINR(gst.totalSGST)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between text-muted-foreground">
                              <span>IGST (incl. in price)</span>
                              <span className="font-medium">{formatINR(gst.totalIGST)}</span>
                            </div>
                          )}
                        </div>
                      )
                    } catch (e) {
                      return null // GST calc errors don't crash bill card
                    }
                  })()}
                  <Separator className="my-1.5" />
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-foreground">Total Amount</span>
                    <span className="text-primary font-display font-extrabold text-base">{formatINR(order?.total)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Payment Mode</p>
                <p className="text-sm font-bold mt-1 text-foreground/90 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                  {order?.payment_method || 'Cash on Delivery (COD)'}
                </p>
                {order?.vendor_name && (
                  <div className="pt-3 mt-3 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Logistics Fulfillment Partner</p>
                    <p className="text-sm font-bold mt-0.5 text-foreground flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-accent" /> {order.vendor_name}
                    </p>
                  </div>
                )}
                {order?.tracking_number && (
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tracking Number</p>
                    <p className="text-xs font-mono font-bold text-accent">{order.tracking_number}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SectionErrorBoundary>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ── Items List ── wrapped in its own boundary */}
        <SectionErrorBoundary sectionName="Order Items">
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-display font-extrabold text-xl px-1">Items In This Order</h3>
            <div className="space-y-3">
              {orderItems.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">No items found for this order.</p>
              ) : orderItems.map((it, idx) => (
                <Card key={it?.id || idx} className="border border-border/40 hover:border-accent/30 transition bg-card/30 overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="relative w-16 h-18 rounded-lg overflow-hidden bg-secondary/40 border border-border/10 shrink-0">
                        <Image
                          src={it?.image || it?.products?.product_images?.[0]?.image_url || '/placeholder.png'}
                          alt={it?.product_name_snapshot || 'Product'}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug">
                          {it?.product_name_snapshot || it?.name || 'Product'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Quantity: <span className="font-semibold text-foreground">{it?.quantity || 0}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Price: <span className="font-semibold text-foreground">{formatINR(it?.price_snapshot)}</span>
                        </p>
                        {it?.products?.hsn_code && (
                          <p className="text-xs text-muted-foreground">
                            HSN: <span className="font-mono font-semibold text-foreground">{it.products.hsn_code}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {it?.product_id && (
                      <Link
                        href={`/product/${it.product_id}`}
                        className="w-8 h-8 rounded-full border border-border/80 hover:bg-secondary flex items-center justify-center shrink-0 transition"
                        aria-label="View Product"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </SectionErrorBoundary>

        {/* ── Tracking Timeline ── wrapped in its own boundary */}
        <SectionErrorBoundary sectionName="Tracking Timeline">
          <div className="space-y-4">
            <h3 className="font-display font-extrabold text-xl px-1">Tracking</h3>

            <Card className="border border-border/40 bg-card/40 radius-lg">
              <CardContent className="p-6">
                <div className="relative border-l border-border/70 pl-6 space-y-8">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const getStepStatusIndex = (status) => {
                      const s = (status || '').toLowerCase().trim()
                      if (s === 'placed') return 0
                      if (s === 'pending_vendor_acceptance') return 1
                      if (s === 'vendor_accepted_pending_admin_approval' || s === 'vendor_accepted') return 2
                      if (s === 'pending_admin_approval') return 3
                      if (s === 'confirmed') return 4
                      if (s === 'packed') return 5
                      if (s === 'shipped') return 6
                      if (s === 'out_for_delivery') return 7
                      if (s === 'delivered') return 8
                      // legacy statuses
                      if (s === 'pending' || s === 'vendor_assigned') return 4
                      return 0
                    }

                    // Check if this is a direct-to-admin order (no vendor step)
                    const isDirectAdmin = statusHistory.some(h => h?.status === 'pending_admin_approval' || h?.status === 'pending') ||
                      orderStatus === 'pending_admin_approval' || orderStatus === 'pending'
                    // Skip optional vendor steps for direct-to-admin orders
                    if (step.optional) {
                      if (isDirectAdmin && (step.key === 'pending_vendor_acceptance' || step.key === 'vendor_accepted_pending_admin_approval')) return null
                      if (!isDirectAdmin && step.key === 'pending_admin_approval') return null
                    }

                    const currentStepIdx = getStepStatusIndex(orderStatus)
                    const stepIdx = getStepStatusIndex(step.key === 'placed' ? 'placed' : step.key)
                    const isDone = stepIdx <= currentStepIdx
                    const isLastActive = step.key === orderStatus || (step.key === 'placed' && currentStepIdx === 0)

                    // Find corresponding history item for timestamp/details
                    const historyItem = statusHistory.find(h => {
                      const hStatus = (h?.status || '').toLowerCase().trim()
                      if (step.key === 'placed') return true
                      if (step.key === 'pending_vendor_acceptance' && (hStatus === 'pending_vendor_acceptance' || hStatus === 'pending')) return true
                      if (step.key === 'vendor_accepted_pending_admin_approval' && (hStatus === 'vendor_accepted_pending_admin_approval' || hStatus === 'vendor_accepted')) return true
                      if (step.key === 'pending_admin_approval' && hStatus === 'pending_admin_approval') return true
                      if (step.key === 'confirmed' && (hStatus === 'confirmed' || hStatus === 'vendor_assigned')) return true
                      return hStatus === step.key
                    })

                    let formattedTime = null
                    try {
                      const ts = (step.key === 'placed' && !historyItem) ? (order.placed_at || order.created_at) : historyItem?.timestamp
                      if (ts) {
                        formattedTime = new Date(ts).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      }
                    } catch (_) {}

                    return (
                      <div key={step.key} className="relative">
                        <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${isLastActive ? 'bg-primary border-primary scale-125 shadow-glow' : isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-background border-border'}`}>
                          {isDone && <CheckCircle2 className="w-3 h-3 text-background" />}
                        </div>

                        <div>
                          <p className={`text-sm font-bold capitalize leading-none ${isLastActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                            {step.label}
                          </p>

                          {formattedTime && (
                            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1 font-semibold">
                              <Calendar className="w-3 h-3" />
                              {formattedTime}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1.5 leading-normal">
                            {step.description}
                          </p>

                          {step.key === 'shipped' && historyItem && (historyItem?.courier_name || historyItem?.tracking_id) && (
                            <div className="mt-2 bg-secondary/40 border border-border/20 p-2.5 rounded-lg text-xs">
                              {historyItem.courier_name && (
                                <p className="text-foreground/80 font-medium">
                                  Courier: <span className="font-semibold text-foreground">{historyItem.courier_name}</span>
                                </p>
                              )}
                              {historyItem.tracking_id && (
                                <p className="text-foreground/80 font-medium mt-0.5">
                                  Tracking ID: <span className="font-mono font-semibold text-foreground">{historyItem.tracking_id}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionErrorBoundary>
      </div>
    </div>
  )
}
