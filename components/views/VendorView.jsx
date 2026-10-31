'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { 
  Truck, Package, Phone, RefreshCw, LogOut, Search, 
  CheckCircle2, AlertCircle, FileText, Download, Calendar, User, 
  MapPin, Eye, ChevronRight, MessageSquare, Award, Clock, ClipboardCheck,
  ShieldCheck, HelpCircle, Layers, ArrowLeft, Loader2,
  IndianRupee, ShoppingCart, TrendingUp, CalendarRange,
  Plus, Minus, Save, History, RotateCcw, ShieldAlert, Check
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAppContext } from '@/components/providers/AppProvider'
import { getStatusLabel } from '@/lib/status-labels'
import { useRealtimeOrders } from '@/lib/hooks/useRealtime'
import { ReportsView } from './admin/ReportsView'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const CHECKPOINT_COLORS = {
  pending_vendor_acceptance: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  vendor_accepted_pending_admin_approval: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
  confirmed: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
  packed: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
  shipped: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
  out_for_delivery: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  vendor_rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
}

export function VendorView() {
  const { user, setUser } = useAppContext()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('new-orders') // 'new-orders' | 'orders'
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  // Vendor financial KPI state (dashboard-stats)
  const [vendorStats, setVendorStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsRange, setStatsRange] = useState('all')

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected Order for detail view page render (inline replacement mode)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  // Quantity Editing & Approval State
  const [editingQuantities, setEditingQuantities] = useState({})
  const [modificationReasons, setModificationReasons] = useState({})
  const [customReasons, setCustomReasons] = useState({})
  const [savingQuantities, setSavingQuantities] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [acceptLoading, setAcceptLoading] = useState(false)

  // 1. Fetch Vendor Orders
  const fetchVendorOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return

      const res = await fetch('/api/vendor/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(Array.isArray(data) ? data : [])
      } else if (res.status === 401) {
        router.push('/vendor/login')
      }
    } catch (e) {
      console.error('[Vendor Orders Fetch Exception]:', e)
    } finally {
      setLoadingOrders(false)
    }
  }, [router])

  // 2. Fetch Read-Only Stock Inventory
  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return

      const res = await fetch('/api/vendor/inventory', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setInventory(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('[Vendor Inventory Exception]:', e)
    } finally {
      setLoadingInventory(false)
    }
  }, [])

  // 3. Fetch Vendor Dashboard Stats (KPI aggregates for selected time period)
  const fetchVendorStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return
      const q = new URLSearchParams({ range: statsRange })
      const res = await fetch('/api/vendor/dashboard-stats?' + q.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setVendorStats(data || null)
      }
    } catch (e) {
      console.error('[Vendor Stats Fetch Exception]:', e)
    } finally {
      setLoadingStats(false)
    }
  }, [statsRange])

  useRealtimeOrders(useCallback(() => {
    fetchVendorOrders()
    fetchVendorStats()
  }, [fetchVendorOrders, fetchVendorStats]))

  // Auth Guard
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let parsedRole = null
    try { parsedRole = storedUser ? JSON.parse(storedUser)?.role : null } catch {}

    if (!token || (parsedRole && parsedRole !== 'vendor' && parsedRole !== 'admin')) {
      router.replace('/vendor/login')
      return
    }
    setAuthReady(true)
  }, [router])

  useEffect(() => {
    if (!authReady) return
    fetchVendorOrders()
    fetchInventory()
    fetchVendorStats()
  }, [authReady, user, fetchVendorOrders, fetchInventory, fetchVendorStats])

  const handleDownloadChallan = async (orderId, orderNum) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/challan-pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let errMsg = 'Failed to download challan'
        try { errMsg = JSON.parse(errText).error || errMsg } catch(e) { errMsg = errText || errMsg }
        throw new Error(errMsg)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `delivery-challan-${orderNum}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDownloadInvoice = async (orderId, orderNum) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice-pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let errMsg = 'Failed to download invoice'
        try { errMsg = JSON.parse(errText).error || errMsg } catch(e) { errMsg = errText || errMsg }
        throw new Error(errMsg)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${orderNum}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Quantity Editing Handlers
  const handleQuantityChange = (itemId, val) => {
    const numVal = parseInt(val, 10)
    if (isNaN(numVal) || numVal < 1) return
    setEditingQuantities(prev => ({ ...prev, [itemId]: numVal }))
  }

  const handleStepQuantity = (itemId, delta) => {
    setEditingQuantities(prev => {
      const cur = Number(prev[itemId] || 1)
      const next = Math.max(1, cur + delta)
      return { ...prev, [itemId]: next }
    })
  }

  const handleResetQuantity = (itemId, originalQty) => {
    setEditingQuantities(prev => ({ ...prev, [itemId]: originalQty }))
    setModificationReasons(prev => ({ ...prev, [itemId]: '' }))
    setCustomReasons(prev => ({ ...prev, [itemId]: '' }))
  }

  const getItemsPayload = (order) => {
    const targetOrder = order || selectedOrder
    if (!targetOrder?.items) return []
    return targetOrder.items.map(it => {
      const appQty = Number(editingQuantities[it.id] ?? it.approved_quantity ?? it.quantity ?? 1)
      const origQty = Number(it.original_quantity ?? it.quantity ?? 1)
      const isModified = appQty !== origQty
      let reason = (modificationReasons[it.id] || '').trim()
      if (reason === 'Other') {
        reason = (customReasons[it.id] || '').trim() || 'Other'
      }
      return {
        id: it.id,
        approved_quantity: appQty,
        modification_reason: isModified ? reason : undefined
      }
    })
  }

  const validateModifications = (order) => {
    const targetOrder = order || selectedOrder
    if (!targetOrder?.items) return { valid: true }
    for (const it of targetOrder.items) {
      const appQty = Number(editingQuantities[it.id] ?? it.approved_quantity ?? it.quantity ?? 1)
      if (!Number.isInteger(appQty) || appQty <= 0) {
        return { valid: false, error: `Quantity for "${it.product_name_snapshot}" must be a positive whole number.` }
      }
      const origQty = Number(it.original_quantity ?? it.quantity ?? 1)
      if (appQty !== origQty) {
        let reason = (modificationReasons[it.id] || '').trim()
        if (reason === 'Other') {
          reason = (customReasons[it.id] || '').trim()
        }
        if (!reason) {
          return { valid: false, error: `Please select or provide a reason for modifying quantity of "${it.product_name_snapshot}".` }
        }
      }
    }
    return { valid: true }
  }

  // Save Quantity Changes (Draft without accepting)
  const handleSaveQuantities = async () => {
    if (!selectedOrder) return
    const val = validateModifications(selectedOrder)
    if (!val.valid) {
      toast.error(val.error)
      return
    }
    setSavingQuantities(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`/api/vendor/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'save_quantities',
          items: getItemsPayload(selectedOrder)
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Approved quantities saved successfully!')
        await fetchVendorOrders()
      } else {
        toast.error(data.error || 'Failed to save quantities')
      }
    } catch {
      toast.error('Network error saving quantities')
    } finally {
      setSavingQuantities(false)
    }
  }

  // Confirm and Accept Order with Approved Quantities
  const handleConfirmAndAccept = async () => {
    if (!selectedOrder) return
    const val = validateModifications(selectedOrder)
    if (!val.valid) {
      toast.error(val.error)
      setShowAcceptModal(false)
      return
    }
    setAcceptLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`/api/vendor/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'accept',
          items: getItemsPayload(selectedOrder)
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Order Accepted! Sent to Owner for final approval.')
        setShowAcceptModal(false)
        await fetchVendorOrders()
      } else {
        toast.error(data.error || 'Failed to accept order')
      }
    } catch {
      toast.error('Network error accepting order')
    } finally {
      setAcceptLoading(false)
    }
  }

  // Reject Order
  const handleRejectOrder = async (orderId) => {
    const reason = prompt('Reason for rejecting this order (optional):')
    if (reason === null) return // user cancelled
    try {
      const res = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'vendor_rejected', rejection_reason: reason || undefined })
      })
      if (res.ok) {
        toast.info('Order rejected. Owner will reassign.')
        fetchVendorOrders()
        setSelectedOrderId(null)
      } else {
        toast.error('Failed to reject order')
      }
    } catch {
      toast.error('Network error rejecting order')
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'user_role=; path=/; max-age=0'
    document.cookie = 'auth_token=; path=/; max-age=0'
    router.push('/vendor/login')
  }

  // Filtered dataset mapping
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Search (ID / Customer Phone / Name / City)
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim()
        const matchId = String(o.order_number || '').toLowerCase().includes(q)
        const matchName = String(o.address?.full_name || '').toLowerCase().includes(q)
        const matchCity = String(o.address?.city || '').toLowerCase().includes(q)
        if (!matchId && !matchName && !matchCity) return false
      }

      // Status selector
      if (statusFilter !== 'all') {
        if (o.status !== statusFilter) return false
      }

      return true
    })
  }, [orders, searchQuery, statusFilter])

  // Split orders into new (pending) and history (rest)
  const newOrders = useMemo(() => filteredOrders.filter(o => o.status === 'pending_vendor_acceptance'), [filteredOrders])
  const historyOrders = useMemo(() => filteredOrders.filter(o => o.status !== 'pending_vendor_acceptance'), [filteredOrders])

  // Stats Counters mapping (updated for new flow)
  const stats = useMemo(() => {
    let pending = 0
    let active = 0
    let delivered = 0

    orders.forEach(o => {
      if (o.status === 'pending_vendor_acceptance') pending++
      else if (['confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(o.status)) active++
      else if (o.status === 'delivered') delivered++
    })

    return { pending, active, delivered }
  }, [orders])

  // Label for the selected Time Period (drives the KPI card sub-labels)
  const RANGE_LABELS = { today: 'Today', 'this-week': 'This Week', 'this-month': 'This Month', all: 'All Time' }
  const rangeLabel = RANGE_LABELS[statsRange] || 'All Time'

  // Get currently selected order details object
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find(o => o.id === selectedOrderId)
  }, [orders, selectedOrderId])

  // Sync editing quantities whenever selected order changes
  useEffect(() => {
    if (selectedOrder) {
      const qMap = {}
      const rMap = {}
      selectedOrder.items?.forEach(it => {
        qMap[it.id] = it.approved_quantity ?? it.quantity ?? 1
        rMap[it.id] = ''
      })
      setEditingQuantities(qMap)
      setModificationReasons(rMap)
      setCustomReasons({})
    } else {
      setEditingQuantities({})
      setModificationReasons({})
      setCustomReasons({})
      setShowAcceptModal(false)
    }
  }, [selectedOrderId, selectedOrder?.updated_at])

  // Recalculated Order Summary for live review
  const recalculatedSummary = useMemo(() => {
    if (!selectedOrder) return null
    let origTotalQty = 0
    let appTotalQty = 0
    let subtotal = 0
    let modifiedCount = 0

    selectedOrder.items?.forEach(it => {
      const orig = Number(it.original_quantity ?? it.quantity ?? 0)
      const app = Number(editingQuantities[it.id] ?? it.approved_quantity ?? it.quantity ?? 0)
      const price = Number(it.price_snapshot || 0)
      origTotalQty += orig
      appTotalQty += app
      subtotal += price * app
      if (app !== orig) modifiedCount++
    })

    const discount = Number(selectedOrder.discount || 0)
    const shipping = Number(selectedOrder.shipping_fee || 0)
    const total = Math.max(0, subtotal - discount + shipping)
    const diffQty = appTotalQty - origTotalQty
    const diffAmount = total - Number(selectedOrder.total || 0)

    return { origTotalQty, appTotalQty, subtotal, total, modifiedCount, diffQty, diffAmount }
  }, [selectedOrder, editingQuantities])

  // Inline Replacement: Render premium details view
  if (selectedOrder) {
    const isPendingVendor = selectedOrder.status === 'pending_vendor_acceptance'

    return (
      <div className="min-h-screen bg-[#F8F9FC] pb-12 font-sans text-left">
        <header className="bg-white border-b border-[#ECECEC] py-4 px-6 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button 
              onClick={() => setSelectedOrderId(null)} 
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 transition-all hover:-translate-x-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Orders Feed
            </button>
            <span className="text-xs font-bold text-slate-400">Order Ref: <strong className="text-slate-800 font-mono">#{selectedOrder.id}</strong></span>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
          {/* Header Action Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-[#ECECEC] shadow-sm">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Logistics Dispatch ID</span>
              <h1 className="font-display text-2xl font-black text-slate-900 mt-1">Order #{selectedOrder.order_number}</h1>
              <p className="text-xs text-slate-400 mt-1">Assigned on {new Date(selectedOrder.placed_at).toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button 
                onClick={() => handleDownloadInvoice(selectedOrder.id, selectedOrder.order_number)}
                variant="outline"
                className="rounded-full border-slate-900 text-slate-900 font-bold text-xs h-10 px-6 hover:bg-slate-100 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" /> Download Tax Invoice
              </Button>
              <Button 
                onClick={() => handleDownloadChallan(selectedOrder.id, selectedOrder.order_number)}
                className="rounded-full bg-slate-900 text-white font-bold text-xs h-10 px-6 hover:bg-slate-800 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" /> Download Delivery Challan
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            
            {/* Left Column details container */}
            <div className="space-y-6">
              
              {/* Order Items — Product Images & Quantity Management */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-base text-slate-800">Order Items & Quantities</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isPendingVendor
                          ? 'Review product images and adjust approved quantities based on stock availability before accepting.'
                          : 'Review product images and approved fulfillment quantities.'}
                      </p>
                    </div>
                    <Badge className="bg-[#F4B942]/10 text-[#A96B0D] font-bold border border-[#F4B942]/20">
                      {selectedOrder.items?.length || 0} Products
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    {selectedOrder.items?.map((it, i) => {
                      const origQty = Number(it.original_quantity ?? it.quantity ?? 1)
                      const currentApproved = Number(it.approved_quantity ?? it.quantity ?? 1)
                      const editedQty = Number(editingQuantities[it.id] ?? currentApproved)
                      const isModified = editedQty !== origQty
                      const deliveredQty = Number(it.delivered_quantity ?? (selectedOrder.status === 'delivered' ? editedQty : 0))
                      const pendingQty = Math.max(0, editedQty - deliveredQty)
                      const lineTotal = (Number(it.price_snapshot) || 0) * editedQty

                      return (
                        <div key={it.id || i} className="p-4 bg-[#F8F9FC] rounded-2xl border border-slate-200/70 hover:border-slate-300 transition-all space-y-3">
                          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            {/* Product Thumbnail & Details */}
                            <div className="flex gap-3.5 items-center min-w-0 flex-1">
                              <div className="relative w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                                {it.image && it.image !== '/placeholder.png' ? (
                                  <img
                                    src={it.image}
                                    alt={it.product_name_snapshot}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null
                                      e.currentTarget.src = '/placeholder.png'
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                                    <Package className="w-6 h-6 stroke-1" />
                                    <span className="text-[8px] font-bold mt-0.5">No Img</span>
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-slate-900 text-sm leading-snug">{it.product_name_snapshot}</p>
                                  {isModified && (
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      editedQty > origQty 
                                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300' 
                                        : 'bg-amber-500/10 text-amber-700 border-amber-300'
                                    }`}>
                                      {editedQty > origQty ? `+${(editedQty - origQty).toLocaleString('en-IN')} Increased` : `${(editedQty - origQty).toLocaleString('en-IN')} Reduced`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                  {it.sku && <span className="font-mono text-[11px] text-slate-400">SKU: {it.sku}</span>}
                                  {it.hsn_code && <span>HSN: <strong className="font-mono text-slate-700">{it.hsn_code}</strong></span>}
                                  <span>Rate: <strong className="text-slate-800">{formatINR(it.price_snapshot)}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Item Subtotal */}
                            <div className="text-right sm:self-center shrink-0">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                              <span className="text-base font-black text-slate-900">{formatINR(lineTotal)}</span>
                            </div>
                          </div>

                          {/* Quantities Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/60 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Original Requested</span>
                              <span className="font-black text-slate-700 text-sm mt-0.5 block">{origQty.toLocaleString('en-IN')}</span>
                            </div>

                            {/* Approved Quantity (Editable if pending) */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block flex items-center justify-between">
                                <span>Approved Qty</span>
                                {isPendingVendor && isModified && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetQuantity(it.id, origQty)}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                )}
                              </span>

                              {isPendingVendor ? (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <button
                                    type="button"
                                    disabled={editedQty <= 1}
                                    onClick={() => handleStepQuantity(it.id, -1)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black disabled:opacity-30 disabled:pointer-events-none"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={editedQty}
                                    onChange={(e) => handleQuantityChange(it.id, e.target.value)}
                                    className="w-20 h-7 rounded-lg border border-slate-200 text-center font-black text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleStepQuantity(it.id, 1)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="font-black text-slate-900 text-sm mt-0.5 block">{editedQty.toLocaleString('en-IN')}</span>
                              )}
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Delivered Qty</span>
                              <span className="font-black text-emerald-600 text-sm mt-0.5 block">{deliveredQty.toLocaleString('en-IN')}</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Pending Qty</span>
                              <span className="font-black text-amber-600 text-sm mt-0.5 block">{pendingQty.toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          {/* Mandatory Reason Field when Modified in Pending Status */}
                          {isPendingVendor && isModified && (
                            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Reason for Quantity Modification *</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select
                                  value={modificationReasons[it.id] || ''}
                                  onChange={(e) => setModificationReasons(prev => ({ ...prev, [it.id]: e.target.value }))}
                                  className="h-8 rounded-lg text-xs bg-white border border-amber-300 px-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="">Select reason...</option>
                                  <option value="Stock unavailable">Stock unavailable</option>
                                  <option value="Partial fulfillment">Partial fulfillment</option>
                                  <option value="Additional stock available">Additional stock available</option>
                                  <option value="Customer-approved quantity revision">Customer-approved quantity revision</option>
                                  <option value="Other">Other</option>
                                </select>

                                {modificationReasons[it.id] === 'Other' && (
                                  <input
                                    type="text"
                                    placeholder="Specify custom reason..."
                                    value={customReasons[it.id] || ''}
                                    onChange={(e) => setCustomReasons(prev => ({ ...prev, [it.id]: e.target.value }))}
                                    className="h-8 rounded-lg text-xs bg-white border border-amber-300 px-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Live Recalculated Order Summary & Save Action Bar */}
                  {isPendingVendor && (
                    <div className="mt-6 pt-5 border-t border-slate-200/80 space-y-4">
                      <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Summary with Approved Quantities</span>
                          {recalculatedSummary?.modifiedCount > 0 && (
                            <span className="text-xs bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full">
                              {recalculatedSummary.modifiedCount} product(s) modified
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Requested Units</span>
                            <span className="font-bold text-white text-sm">{recalculatedSummary?.origTotalQty?.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Approved Units</span>
                            <span className="font-bold text-[#F4B942] text-sm">{recalculatedSummary?.appTotalQty?.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Items Subtotal</span>
                            <span className="font-bold text-white text-sm">{formatINR(recalculatedSummary?.subtotal)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Final Payable</span>
                            <span className="font-black text-emerald-400 text-base">{formatINR(recalculatedSummary?.total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={savingQuantities}
                          onClick={handleSaveQuantities}
                          className="rounded-full border-slate-300 font-bold text-xs h-10 px-6 hover:bg-slate-100 gap-1.5"
                        >
                          {savingQuantities ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Quantity Changes
                        </Button>

                        <Button
                          type="button"
                          onClick={() => {
                            const val = validateModifications(selectedOrder)
                            if (!val.valid) {
                              toast.error(val.error)
                              return
                            }
                            setShowAcceptModal(true)
                          }}
                          className="rounded-full bg-slate-900 text-white font-bold text-xs h-10 px-8 hover:bg-slate-800 gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Accept Order...
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Recipient contacts info */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-display font-bold text-sm text-slate-800">Customer Shipping Address & Connect</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-3 bg-[#F8F9FC] p-4 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Recipient Contact</span>
                        <span className="font-black text-slate-800 text-sm mt-1 block">{selectedOrder.address?.full_name}</span>
                        <span className="font-semibold text-slate-500 font-mono block mt-1">📞 {selectedOrder.address?.phone}</span>
                      </div>
                      {selectedOrder.address?.gst && (
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">GSTIN Number</span>
                          <span className="font-bold text-slate-800 font-mono block mt-1 text-[#F4B942]">{selectedOrder.address.gst}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 bg-[#F8F9FC] p-4 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Address Details</span>
                      <p className="text-slate-600 font-medium leading-relaxed mt-2">
                        {selectedOrder.address?.line1}<br />
                        {selectedOrder.address?.line2 && <>{selectedOrder.address.line2}<br /></>}
                        {selectedOrder.address?.city}, {selectedOrder.address?.state} {selectedOrder.address?.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Customer Quick contact links */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <a 
                      href={`tel:${selectedOrder.address?.phone}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-full bg-slate-50 hover:bg-slate-100 border text-slate-600 font-bold text-xs transition"
                    >
                      ☎ Call Customer
                    </a>
                    <a 
                      href={`https://wa.me/${selectedOrder.address?.phone || ''}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs transition"
                    >
                      💬 WhatsApp
                    </a>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedOrder.address?.line1 || ''} ${selectedOrder.address?.city || ''} ${selectedOrder.address?.pincode || ''}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs transition"
                    >
                      📍 Google Maps
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Logistics Info — Dates & Tracking */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6 space-y-3">
                  <h3 className="font-display font-bold text-sm text-slate-800">Dispatch & Delivery Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Dispatch Date</span>
                      <span className="font-bold text-slate-800 mt-1 block">{selectedOrder.dispatch_date ? new Date(selectedOrder.dispatch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Delivery Date</span>
                      <span className="font-bold text-slate-800 mt-1 block">{selectedOrder.delivered_at ? new Date(selectedOrder.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Tracking Number</span>
                      <span className="font-mono font-bold text-slate-800 mt-1 block">{selectedOrder.tracking_number || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quantity Modification Audit Trail (If modifications exist) */}
              {Array.isArray(selectedOrder.quantity_modifications) && selectedOrder.quantity_modifications.length > 0 && (
                <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden border-l-4 border-l-[#F4B942]">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-4 h-4 text-[#A96B0D]" />
                      <h3 className="font-display font-bold text-sm text-slate-800">Quantity Modification History</h3>
                    </div>
                    <div className="space-y-3">
                      {selectedOrder.quantity_modifications.map((m, idx) => (
                        <div key={m.id || idx} className="p-3.5 bg-[#F8F9FC] rounded-xl border border-slate-100 text-xs space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-bold text-slate-900">{m.product_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(m.created_at).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-slate-600">
                            <span>Requested: <strong className="text-slate-800">{m.original_quantity}</strong></span>
                            <span>&bull;</span>
                            <span>Revision: <strong className="text-amber-700">{m.previous_approved_quantity} &rarr; {m.new_approved_quantity}</strong></span>
                            <span>&bull;</span>
                            <span>By: <strong className="text-slate-800">{m.modifier_name || 'Zonal Admin'}</strong></span>
                          </div>
                          <p className="text-[11px] text-slate-500 pt-0.5">Reason: <em className="text-slate-700 not-italic font-medium">{m.modification_reason}</em></p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status Timeline checkpoints (vertical style matching owner/customer side) */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="font-display font-bold text-sm text-slate-800 mb-6">Tracking Timeline</h3>
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-5">
                    {selectedOrder.status_history?.map((step, idx) => (
                      <div key={idx} className="relative text-left">
                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-950 border-4 border-white" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 capitalize">{getStatusLabel(step.status)}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{step.note}</p>
                          <span className="text-[9px] text-slate-400 block mt-1">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                    {(!selectedOrder.status_history || selectedOrder.status_history.length === 0) && (
                      <p className="text-xs text-slate-450 py-4 text-left">No status history available yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column sidebar */}
            <div className="space-y-6">
              
              {/* Checkpoint controller actions */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden border-l-4 border-l-[#F4B942]">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-display font-black text-xs uppercase text-slate-400 tracking-wider">Order Status</h3>
                  
                  {isPendingVendor ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" /> Action Required
                        </p>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Please verify product items and modify approved quantities if stock is limited. Then accept the order to send for Owner final approval.
                        </p>
                      </div>

                      {/* Financial summary snapshot */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Items Subtotal:</span>
                          <span className="font-bold text-slate-800">{formatINR(recalculatedSummary?.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Approved Units:</span>
                          <span className="font-bold text-slate-800">{recalculatedSummary?.appTotalQty?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
                          <span className="text-slate-700">Total Payable:</span>
                          <span className="text-sm font-black text-slate-900">{formatINR(recalculatedSummary?.total)}</span>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Button 
                          onClick={() => {
                            const val = validateModifications(selectedOrder)
                            if (!val.valid) {
                              toast.error(val.error)
                              return
                            }
                            setShowAcceptModal(true)
                          }}
                          className="w-full rounded-full font-bold h-11 bg-slate-900 text-white text-xs hover:bg-slate-800 shadow-sm gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ✓ Accept Order
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleRejectOrder(selectedOrder.id)}
                          className="w-full rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 font-bold h-11 text-xs"
                        >
                          ✕ Reject Order
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Badge className={`capitalize font-bold text-[10px] rounded-full px-3 py-1 ${CHECKPOINT_COLORS[selectedOrder.status] || 'bg-slate-100 text-slate-600'}`}>
                        {getStatusLabel(selectedOrder.status)}
                      </Badge>
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Final Order Value</span>
                        <span className="text-lg font-black text-slate-900 block">{formatINR(selectedOrder.total)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        {selectedOrder.status === 'confirmed' && 'Order accepted — Owner will process fulfillment.'}
                        {selectedOrder.status === 'packed' && 'Order packed at warehouse, awaiting dispatch.'}
                        {selectedOrder.status === 'shipped' && 'Package dispatched to courier partner.'}
                        {selectedOrder.status === 'out_for_delivery' && 'Courier partner is delivering today.'}
                        {selectedOrder.status === 'delivered' && 'Order delivered successfully.'}
                        {selectedOrder.status === 'vendor_rejected' && 'You rejected this order — needs Owner reassignment.'}
                        {selectedOrder.status === 'cancelled' && 'Order was cancelled.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

          </div>
        </div>

        {/* Acceptance Confirmation Modal with Breakdown */}
        <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
          <DialogContent className="max-w-md rounded-2xl bg-white p-6 text-left">
            <DialogHeader>
              <DialogTitle className="font-display font-black text-xl text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Confirm Order Acceptance
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Please review the finalized quantities before sending to Owner for confirmation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Original Total Quantity:</span>
                  <span className="font-bold text-slate-800 text-sm">{recalculatedSummary?.origTotalQty?.toLocaleString('en-IN')} units</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Final Approved Quantity:</span>
                  <span className="font-black text-slate-900 text-sm">{recalculatedSummary?.appTotalQty?.toLocaleString('en-IN')} units</span>
                </div>
                {recalculatedSummary?.modifiedCount > 0 && (
                  <div className="flex justify-between items-center text-amber-700 font-bold pt-1 border-t border-slate-200/60">
                    <span>Modified Products:</span>
                    <span>{recalculatedSummary.modifiedCount} product(s)</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-bold">Updated Order Value:</span>
                  <span className="font-black text-slate-900 text-base">{formatINR(recalculatedSummary?.total)}</span>
                </div>
              </div>

              {/* Breakdown of modified items if any */}
              {recalculatedSummary?.modifiedCount > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 text-[11px] block">Modified Items Breakdown:</span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedOrder.items?.map(it => {
                      const orig = Number(it.original_quantity ?? it.quantity ?? 1)
                      const app = Number(editingQuantities[it.id] ?? orig)
                      if (orig === app) return null
                      const reason = modificationReasons[it.id] === 'Other' ? (customReasons[it.id] || 'Other') : (modificationReasons[it.id] || 'Modified')
                      return (
                        <div key={it.id} className="p-2 bg-amber-500/10 rounded-lg border border-amber-200 flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-slate-800 line-clamp-1">{it.product_name_snapshot}</p>
                            <p className="text-[10px] text-amber-700">Reason: {reason}</p>
                          </div>
                          <span className="font-mono font-bold text-amber-800 shrink-0">
                            {orig} &rarr; {app}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Once accepted, this order will be routed to the Owner for final confirmation. The customer and branch manager will see the approved quantities.
              </p>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 rounded-full font-bold h-11 text-xs border-slate-200 hover:bg-slate-100"
                >
                  Go Back & Review
                </Button>
                <Button
                  type="button"
                  disabled={acceptLoading}
                  onClick={handleConfirmAndAccept}
                  className="flex-1 rounded-full bg-slate-900 text-white font-bold h-11 text-xs hover:bg-slate-800 gap-1.5"
                >
                  {acceptLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  Confirm & Accept
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Dashboard Page Listing View
  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 pb-12 font-sans text-left">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#ECECEC] py-4 px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center font-bold text-[#F4B942] shadow-xs">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-black text-sm text-slate-800 tracking-tight leading-none">AK Enterprises Zonal Admin Portal</h1>
              <span className="text-[10px] text-muted-foreground font-bold mt-1 block">Zonal Admin Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider leading-none">Zonal Admin</span>
              <span className="text-xs font-black text-slate-800 mt-1">{user?.full_name || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="rounded-full h-9 px-4 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container Page */}
      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        
        {/* Welcome Greeting Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-md">
          <div className="absolute right-0 bottom-0 top-0 opacity-10 pointer-events-none flex items-center pr-12">
            <Truck className="w-48 h-48" />
          </div>
          <div className="space-y-1 relative z-10">
            <h2 className="font-display font-black text-xl md:text-2xl tracking-tight">Welcome back, {user?.full_name || 'Zonal Admin'}</h2>
            <p className="text-xs text-slate-400 font-medium">
              You have <strong className="text-white">{stats.pending} orders</strong> awaiting your acceptance and <strong className="text-white">{stats.active} orders</strong> confirmed for processing.
            </p>
          </div>
        </div>

        {/* 3 Premium KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Awaiting Acceptance</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.pending}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Confirmed Orders</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.active}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Delivered Orders</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.delivered}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zonal Admin Financial KPI Cards + Time Period Filter */}
        <div className="bg-white p-4 border border-[#ECECEC] rounded-2xl shadow-xs flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-display font-black text-sm text-slate-800">Performance Snapshot</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Orders, revenue & average order value across your assigned dispatches.</p>
          </div>
          <div className="w-full sm:w-44">
            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">Time Period</label>
            <Select value={statsRange} onValueChange={setStatsRange}>
              <SelectTrigger className="w-full rounded-full h-10 text-xs bg-white border-[#ECECEC]">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Orders Assigned (all-time) */}
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total Orders Assigned</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{loadingStats ? '…' : (vendorStats?.totalOrders ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Revenue (selected time period) */}
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Revenue ({rangeLabel})</span>
                <span className="text-xl font-black text-slate-800 mt-1 block truncate">{loadingStats ? '…' : formatINR(vendorStats?.rangeRevenue ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* This Month Orders */}
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">This Month Orders</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{loadingStats ? '…' : (vendorStats?.thisMonthOrders ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* This Month Revenue */}
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">This Month Revenue</span>
                <span className="text-xl font-black text-slate-800 mt-1 block truncate">{loadingStats ? '…' : formatINR(vendorStats?.thisMonthRevenue ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Order Value (selected time period) */}
          <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Avg Order Value</span>
                <span className="text-xl font-black text-slate-800 mt-1 block truncate">{loadingStats ? '…' : formatINR(vendorStats?.avgOrderValue ?? 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab switcher navigation — New Orders + Order History + Performance */}
        <div className="flex bg-white p-1 rounded-full border border-[#ECECEC] max-w-lg shadow-xs">
          <button
            onClick={() => { setActiveTab('new-orders'); setStatusFilter('all') }}
            className={`flex-1 py-2 px-3 rounded-full font-bold text-xs transition ${activeTab === 'new-orders' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            New Orders ({stats.pending})
          </button>
          <button
            onClick={() => { setActiveTab('orders'); setStatusFilter('all') }}
            className={`flex-1 py-2 px-3 rounded-full font-bold text-xs transition ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Order History
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 px-3 rounded-full font-bold text-xs transition ${activeTab === 'reports' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Reports
          </button>
        </div>

        {/* ======================== NEW ORDERS TAB ======================== */}
        {activeTab === 'new-orders' && (
          <div className="space-y-4 slide-up">
            {loadingOrders ? (
              <div className="text-center py-16 text-xs text-slate-400 font-semibold animate-pulse">Syncing new orders...</div>
            ) : newOrders.length === 0 ? (
              <div className="bg-white border border-[#ECECEC] rounded-2xl py-16 text-center shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-800">All caught up!</p>
                <p className="text-[10px] text-slate-400 mt-1">No new orders awaiting your acceptance right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {newOrders.map(o => {
                  const totalItems = o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0
                  return (
                    <Card key={o.id} className="bg-white border-2 border-amber-300 hover:border-amber-400 transition-all rounded-3xl shadow-sm overflow-hidden">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-amber-100 pb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-800">Order #{o.order_number}</span>
                              <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-[9px] rounded-full px-2.5 py-0.5">
                                Awaiting Acceptance
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">Placed on {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAcceptOrder(o.id)} className="h-9 text-xs font-bold rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5">
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRejectOrder(o.id)} className="h-9 text-xs font-bold rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 px-5">
                              Reject
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4">
                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Shipping Address & Contact</span>
                            <p className="font-black text-slate-800 text-sm mt-2">{o.address?.full_name}</p>
                            <p className="text-slate-500 font-bold">Phone: {o.address?.phone}</p>
                            <p className="text-slate-500 leading-relaxed font-medium">
                              {o.address?.line1}, {o.address?.line2 && o.address.line2 + ', '}{o.address?.city}, {o.address?.state} — <strong className="text-slate-700">{o.address?.pincode}</strong>
                            </p>
                          </div>
                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-3 text-xs flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>Items ({o.items?.length || 0})</span>
                                <span>Qty {totalItems}</span>
                              </div>
                              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto mt-2 pr-1 font-medium text-slate-700">
                                {o.items?.map((it, idx) => (
                                  <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                                    <span className="truncate max-w-[200px]">{it.product_name_snapshot}</span>
                                    <Badge className="font-bold text-[10px] bg-slate-100 text-slate-700 shrink-0">Qty {it.quantity}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200/60 pt-3">
                              <span className="text-[10px] text-slate-400 font-bold">{o.items?.length || 0} items</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedOrderId(o.id)} 
                                className="h-8 text-xs font-bold text-slate-900 hover:bg-slate-100 rounded-full"
                              >
                                View Details →
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================== ORDER HISTORY TAB ======================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 slide-up">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 border border-[#ECECEC] rounded-2xl shadow-xs">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <Input
                  placeholder="Search by Order ID, Customer name or City..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-full bg-[#F8F9FC] border-transparent focus:bg-white text-xs transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 rounded-full h-10 text-xs bg-white border-[#ECECEC]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="packed">Packed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="vendor_rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchVendorOrders} className="rounded-full h-10 text-xs px-4">
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
                </Button>
              </div>
            </div>

            {loadingOrders ? (
              <div className="text-center py-16 text-xs text-slate-400 font-semibold animate-pulse">Syncing orders database...</div>
            ) : historyOrders.length === 0 ? (
              <div className="bg-white border border-[#ECECEC] rounded-2xl py-16 text-center text-xs text-slate-400 font-bold shadow-xs">
                No orders match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {historyOrders.map(o => {
                  const totalItems = o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0
                  return (
                    <Card key={o.id} className="bg-white border border-[#ECECEC] hover:border-slate-300 transition-all rounded-3xl shadow-sm overflow-hidden">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-800">Order #{o.order_number}</span>
                              <Badge className={`capitalize font-bold text-[9px] rounded-full px-2.5 py-0.5 ${CHECKPOINT_COLORS[o.status] || 'bg-slate-100 text-slate-600'}`}>
                                {getStatusLabel(o.status)}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">Placed on {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500 border-slate-200">
                            {o.status === 'delivered' ? 'Completed' : o.status === 'vendor_rejected' ? 'Rejected' : 'In Progress'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4">
                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Shipping Address & Contact</span>
                            <p className="font-black text-slate-800 text-sm mt-2">{o.address?.full_name}</p>
                            <p className="text-slate-500 font-bold">Phone: {o.address?.phone}</p>
                            <p className="text-slate-500 leading-relaxed font-medium">
                              {o.address?.line1}, {o.address?.line2 && o.address.line2 + ', '}{o.address?.city}, {o.address?.state} — <strong className="text-slate-700">{o.address?.pincode}</strong>
                            </p>
                          </div>
                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-3 text-xs flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>Items ({o.items?.length || 0})</span>
                                <span>Qty {totalItems}</span>
                              </div>
                              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto mt-2 pr-1 font-medium text-slate-700">
                                {o.items?.map((it, idx) => (
                                  <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                                    <span className="truncate max-w-[200px]">{it.product_name_snapshot}</span>
                                    <Badge className="font-bold text-[10px] bg-slate-100 text-slate-700 shrink-0">Qty {it.quantity}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200/60 pt-3">
                              <span className="text-[10px] text-slate-400 font-bold">{o.items?.length || 0} items</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedOrderId(o.id)} 
                                className="h-8 text-xs font-bold text-slate-900 hover:bg-slate-100 rounded-full"
                              >
                                View Details →
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================== REPORTS TAB (zone-scoped) ======================== */}
        {activeTab === 'reports' && (
          <ReportsView />
        )}

      </main>
    </div>
  )
}