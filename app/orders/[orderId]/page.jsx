'use client'
import React, { useState, useEffect } from 'react'
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
  XCircle, RotateCcw, AlertCircle, X
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const TIMELINE_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', description: 'Your B2B order has been verified and confirmed.' },
  { key: 'shipped', label: 'Shipped', description: 'Your dispatch is handled by our courier partner.' },
  { key: 'out for delivery', label: 'Out for Delivery', description: 'The courier is arriving at your warehouse/office location.' },
  { key: 'delivered', label: 'Delivered', description: 'Delivery completed successfully.' }
]

export default function OrderDetailsPage() {
  const { user } = useAppContext()
  const router = useRouter()
  const params = useParams()
  const orderId = params.orderId

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
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) throw new Error('Order not found')
      const data = await res.json()
      setOrder(data)
    } catch (err) {
      toast.error(err.message)
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status: 'cancelled' })
      })
      if (!res.ok) throw new Error('Failed to cancel order')
      setOrder(prev => ({ ...prev, status: 'cancelled' }))
      toast.success('Order cancelled successfully')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelLoading(false)
    }
  }

  const handleReturnRequest = async () => {
    if (!returnReason) { toast.error('Please select a reason'); return }
    setReturnLoading(true)
    try {
      const res = await fetch('/api/return-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ order_id: orderId, reason: returnReason, details: returnDetails })
      })
      if (!res.ok) throw new Error('Failed to submit return request')
      setOrder(prev => ({ ...prev, status: 'returned' }))
      setShowReturnModal(false)
      toast.success('Return request submitted! We will contact you within 24 hours.')
    } catch (err) {
      toast.error(err.message)
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

  if (!mounted || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!order) return null

  // PDF tax invoice print handler
  const handleDownloadInvoice = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups for this website to print/download invoice.')
      return
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order.order_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #d4af37; letter-spacing: -0.02em; }
            .title { font-size: 26px; font-weight: 800; text-transform: uppercase; margin: 0; color: #1a202c; }
            .meta-section { display: flex; justify-content: space-between; margin-bottom: 35px; }
            .meta-box { flex: 1; }
            .meta-box h3 { font-size: 11px; text-transform: uppercase; color: #718096; margin-bottom: 8px; letter-spacing: 0.05em; font-weight: bold; }
            .meta-box p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #f7fafc; border-bottom: 2px solid #edf2f7; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; color: #718096; font-weight: bold; }
            td { padding: 12px; border-bottom: 1px solid #edf2f7; }
            .text-right { text-align: right; }
            .totals { width: 45%; margin-left: auto; margin-top: 20px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .totals-row.grand { border-top: 2px solid #e2e8f0; font-size: 15px; font-weight: 800; color: #1a202c; padding-top: 10px; }
            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">AK ENTERPRISES</div>
              <p style="margin: 4px 0 0 0; color: #718096; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">Trusted B2B Supply Partner</p>
            </div>
            <div class="text-right">
              <h1 class="title">Tax Invoice</h1>
              <p style="margin: 4px 0 0 0; font-weight: 600; color: #4a5568;">Invoice No: INV-${order.order_number}</p>
            </div>
          </div>
          
          <div class="meta-section">
            <div class="meta-box">
              <h3>Supplier</h3>
              <p><strong>AK Enterprises</strong></p>
              <p>B2B Warehousing Hub, Sector 4</p>
              <p>Pune, Maharashtra - 411001</p>
              <p>GSTIN: 27AAAAA1111A1Z1</p>
              <p>Email: billing@akenterprises.com</p>
            </div>
            <div class="meta-box" style="padding-left: 30px;">
              <h3>Shipping To</h3>
              <p><strong>${order.address?.full_name}</strong></p>
              <p>Phone: ${order.address?.phone}</p>
              <p>${order.address?.line1}</p>
              ${order.address?.line2 ? `<p>${order.address.line2}</p>` : ''}
              <p>${order.address?.city}, ${order.address?.state} - ${order.address?.pincode}</p>
            </div>
            <div class="meta-box text-right">
              <h3>Details</h3>
              <p><strong>Order Reference:</strong> ${order.order_number}</p>
              <p><strong>Date:</strong> ${new Date(order.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><strong>Payment Mode:</strong> ${order.payment_method}</p>
              <p><strong>Status:</strong> ${order.status === 'delivered' ? 'Fully Paid' : 'Pending Verification'}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Item Description</th>
                <th style="width: 15%;" class="text-right">Price (INR)</th>
                <th style="width: 15%;" class="text-right">Quantity</th>
                <th style="width: 20%;" class="text-right">Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map(it => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: #2d3748;">${it.product_name_snapshot}</div>
                  </td>
                  <td class="text-right">${formatINR(it.price_snapshot)}</td>
                  <td class="text-right">${it.quantity}</td>
                  <td class="text-right">${formatINR(it.price_snapshot * it.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="totals-row">
              <span style="color: #718096;">Gross Subtotal</span>
              <span>${formatINR(order.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span style="color: #718096;">Trade Discount</span>
              <span>-${formatINR(order.discount || 0)}</span>
            </div>
            <div class="totals-row">
              <span style="color: #718096;">Delivery Charges</span>
              <span>${order.shipping_fee > 0 ? formatINR(order.shipping_fee) : 'Free Delivery'}</span>
            </div>
            <div class="totals-row grand">
              <span>Grand Total</span>
              <span>${formatINR(order.total)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for your business. For any invoice queries, contact support@akenterprises.com.</p>
            <p>This is a system-generated B2B Tax Invoice compliant with GST regulations and requires no signature.</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  // Calculate timeline progress
  const activeStepIdx = TIMELINE_STEPS.findIndex(step => step.key === order.status.toLowerCase())
  const currentStep = activeStepIdx !== -1 ? activeStepIdx : 0

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Order Details</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Order Number: <span className="font-mono font-bold text-foreground">{order.order_number}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleDownloadInvoice} variant="outline" size="sm" className="rounded-full h-9 px-4 flex items-center gap-2 shadow-sm">
            <FileText className="w-4 h-4" /> Invoice
          </Button>
          {/* Cancel Order Button - only for pending/confirmed */}
          {['pending', 'confirmed'].includes(order.status?.toLowerCase()) && (
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
          {/* Return Request Button - only for delivered */}
          {order.status?.toLowerCase() === 'delivered' && (
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

      {/* Return Request Modal */}
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
        {/* Shipping Address Card */}
        <Card className="md:col-span-2 border border-border/40 bg-card/50 radius-lg">
          <CardContent className="p-6">
            <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" /> Shipping Address
            </h3>
            {order.address ? (
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p className="font-bold text-foreground">{order.address.full_name}</p>
                <p className="font-semibold text-foreground/80">{order.address.phone}</p>
                <p>{order.address.line1}</p>
                {order.address.line2 && <p>{order.address.line2}</p>}
                <p>{order.address.city}, {order.address.state} - <span className="font-semibold text-foreground">{order.address.pincode}</span></p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Address details not available</p>
            )}
          </CardContent>
        </Card>

        {/* Pricing Summary Card */}
        <Card className="border border-border/40 bg-card/50 radius-lg">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" /> Bill Details
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Price</span>
                  <span className="font-medium text-foreground">{formatINR(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discounts</span>
                  <span className="font-medium text-destructive">-{formatINR(order.discount || 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping Fee</span>
                  <span className="font-medium text-foreground">
                    {order.shipping_fee > 0 ? formatINR(order.shipping_fee) : 'FREE'}
                  </span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">Total Amount</span>
                  <span className="text-primary font-display font-extrabold text-base">{formatINR(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Payment Mode</p>
              <p className="text-sm font-bold mt-1 text-foreground/90 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                {order.payment_method || 'Cash on Delivery (COD)'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Order Items Section */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-display font-extrabold text-xl px-1">Items In This Order</h3>
          
          <div className="space-y-3">
            {order.items?.map(it => (
              <Card key={it.id} className="border border-border/40 hover:border-accent/30 transition bg-card/30 overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="relative w-16 h-18 rounded-lg overflow-hidden bg-secondary/40 border border-border/10 shrink-0">
                      <Image 
                        src={it.image || '/placeholder.png'} 
                        alt={it.product_name_snapshot}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug">
                        {it.product_name_snapshot}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Quantity: <span className="font-semibold text-foreground">{it.quantity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Price: <span className="font-semibold text-foreground">{formatINR(it.price_snapshot)}</span>
                      </p>
                    </div>
                  </div>
                  
                  {it.product_id && (
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

        {/* Tracking Timeline Section */}
        <div className="space-y-4">
          <h3 className="font-display font-extrabold text-xl px-1">Tracking</h3>
          
          <Card className="border border-border/40 bg-card/40 radius-lg">
            <CardContent className="p-6">
              <div className="relative border-l border-border/70 pl-6 space-y-8">
                {TIMELINE_STEPS.map((step, idx) => {
                  const historyItem = order.status_history?.find(h => h.status.toLowerCase() === step.key.toLowerCase())
                  const isDone = !!historyItem
                  const isLastActive = step.key === order.status.toLowerCase()
                  
                  const formattedTime = historyItem
                    ? new Date(historyItem.timestamp).toLocaleString('en-IN', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })
                    : null

                  return (
                    <div key={step.key} className="relative">
                      {/* Timeline Dot */}
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
                        
                        {/* Shipped-specific courier details */}
                        {step.key === 'shipped' && historyItem && (historyItem.courier_name || historyItem.tracking_id) && (
                          <div className="mt-2 bg-secondary/40 border border-border/20 p-2.5 rounded-lg text-xs">
                            {historyItem.courier_name && <p className="text-foreground/80 font-medium">Courier: <span className="font-semibold text-foreground">{historyItem.courier_name}</span></p>}
                            {historyItem.tracking_id && <p className="text-foreground/80 font-medium mt-0.5">Tracking ID: <span className="font-mono font-semibold text-foreground">{historyItem.tracking_id}</span></p>}
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
      </div>
    </div>
  )
}
