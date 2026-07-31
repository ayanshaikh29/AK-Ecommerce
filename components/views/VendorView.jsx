'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { 
  Truck, Package, Phone, RefreshCw, LogOut, Search, 
  CheckCircle2, AlertCircle, FileText, Download, Calendar, User, 
  MapPin, Eye, ChevronRight, MessageSquare, Award, Clock, ClipboardCheck,
  ShieldCheck, HelpCircle, Layers, ArrowLeft
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppContext } from '@/components/providers/AppProvider'
import { useRealtimeOrders } from '@/lib/hooks/useRealtime'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const CHECKPOINT_COLORS = {
  vendor_assigned: 'bg-amber-500/10 text-amber-600 border border-amber-500/20', // Pending Acceptance
  vendor_accepted: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',     // Accepted
  packed: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',        // Packed
  out_for_delivery: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20', // Out for Delivery
  delivered: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',  // Delivered
  cancelled: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  vendor_rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
}

export function VendorView() {
  const { user, setUser } = useAppContext()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'inventory' | 'performance'
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected Order for detail view page render (inline replacement mode)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [exportingReport, setExportingReport] = useState(false)

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

  useRealtimeOrders(fetchVendorOrders)

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
  }, [authReady, user, fetchVendorOrders, fetchInventory])

  const handleExportReport = async () => {
    setExportingReport(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/vendor/reports/export?range=6months', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to export report')
      }
      
      // Since backend returns PDF stream directly
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const vendorNameClean = (user?.full_name || 'Vendor').replace(/\s+/g, '_')
      a.download = `Vendor_Report_Last_6_Months_${vendorNameClean}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Report exported successfully.')
    } catch (err) {
      toast.error(err.message || 'Report export failed.')
    } finally {
      setExportingReport(false)
    }
  }

  // Accept Order
  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action: 'accept' })
      })
      if (res.ok) {
        toast.success('Order Accepted! Added to Active Deliveries.')
        fetchVendorOrders()
      } else {
        toast.error('Failed to accept order')
      }
    } catch {
      toast.error('Network error accepting order')
    }
  }

  // Reject Order
  const handleRejectOrder = async (orderId) => {
    if (!confirm('Decline this dispatch shipment?')) return
    try {
      const res = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'vendor_rejected' })
      })
      if (res.ok) {
        toast.info('Shipment declined.')
        fetchVendorOrders()
        setSelectedOrderId(null)
      } else {
        toast.error('Failed to decline shipment')
      }
    } catch {
      toast.error('Network error declining shipment')
    }
  }

  // Live status transitions
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        toast.success(`Shipment checkpoint updated: ${newStatus.replace(/_/g, ' ').toUpperCase()}`)
        fetchVendorOrders()
      } else {
        toast.error('Failed to update shipment status')
      }
    } catch {
      toast.error('Network error updating status')
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

  // Stats Counters mapping
  const stats = useMemo(() => {
    let pending = 0
    let active = 0
    let delivered = 0

    orders.forEach(o => {
      if (o.status === 'vendor_assigned') pending++
      else if (['vendor_accepted', 'packed', 'shipped', 'out_for_delivery'].includes(o.status)) active++
      else if (o.status === 'delivered') delivered++
    })

    return { pending, active, delivered }
  }, [orders])

  // Get currently selected order details object
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find(o => o.id === selectedOrderId)
  }, [orders, selectedOrderId])

  // Inline Replacement: Render premium details view
  if (selectedOrder) {
    const totalVal = selectedOrder.total_amount || 0
    const subtotalVal = selectedOrder.total_amount - (selectedOrder.shipping_fee || 0)
    const shippingVal = selectedOrder.shipping_fee || 0

    // Derive active timeline step percentage
    const stepMap = { 'vendor_assigned': 15, 'vendor_accepted': 40, 'packed': 60, 'out_for_delivery': 80, 'delivered': 100 }
    const activePercent = stepMap[selectedOrder.status] || 10

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
            <div className="flex gap-3">
              <Button 
                onClick={() => import('@/lib/invoice').then(({ downloadInvoice }) => downloadInvoice(selectedOrder))} 
                className="rounded-full bg-slate-900 text-white font-bold text-xs h-10 px-6 hover:bg-slate-800 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" /> Download Invoice
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            
            {/* Left Column details container */}
            <div className="space-y-6">
              
              {/* Product items costing snapshot */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display font-extrabold text-sm text-slate-800">Fulfillment Product Costing Table</h3>
                    <Badge className="bg-[#F4B942]/10 text-[#A96B0D] font-bold border border-[#F4B942]/20">{selectedOrder.items?.length || 0} Products</Badge>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedOrder.items?.map((it, i) => (
                      <div key={i} className="py-4 flex gap-4 items-center">
                        <div className="w-12 h-14 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate text-sm">{it.product_name_snapshot}</p>
                          <p className="text-xs text-slate-400 mt-1">Qty {it.quantity} · Unit Price {formatINR(it.price_snapshot)}</p>
                        </div>
                        <span className="font-black text-slate-800 text-sm">{formatINR(it.price_snapshot * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
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

              {/* Status Timeline checkpoints with animated progress bar */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-display font-extrabold text-sm text-slate-800">Fulfillment Checklist Progress</h3>
                    <span className="text-xs text-slate-400 font-bold">{activePercent}% Completed</span>
                  </div>

                  {/* Progress Line */}
                  <div className="relative w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                    <div className="absolute top-0 left-0 bg-[#F4B942] h-2 transition-all duration-500" style={{ width: `${activePercent}%` }} />
                  </div>

                  <div className="grid grid-cols-5 text-center text-[10px] font-bold text-slate-400 gap-1">
                    <div className={selectedOrder.status_history?.some(h => h.status === 'vendor_assigned') ? 'text-[#F4B942] font-black' : ''}>
                      ✔ Assigned
                    </div>
                    <div className={selectedOrder.status_history?.some(h => h.status === 'vendor_accepted') ? 'text-[#F4B942] font-black' : ''}>
                      ✔ Accepted
                    </div>
                    <div className={selectedOrder.status_history?.some(h => h.status === 'packed') ? 'text-[#F4B942] font-black' : ''}>
                      📦 Packed
                    </div>
                    <div className={selectedOrder.status_history?.some(h => h.status === 'out_for_delivery') ? 'text-[#F4B942] font-black' : ''}>
                      🚚 Dispatch
                    </div>
                    <div className={selectedOrder.status === 'delivered' ? 'text-emerald-600 font-black' : ''}>
                      🏠 Delivered
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column sidebar */}
            <div className="space-y-6">
              
              {/* Checkpoint controller actions */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden border-l-4 border-l-[#F4B942]">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-display font-black text-xs uppercase text-slate-400 tracking-wider">Fulfillment Stage</h3>
                  
                  {selectedOrder.status === 'vendor_assigned' ? (
                    <div className="grid gap-2">
                      <Button 
                        onClick={() => handleAcceptOrder(selectedOrder.id)}
                        className="w-full rounded-full font-bold h-11 bg-slate-900 text-white text-xs hover:bg-slate-800 shadow-sm"
                      >
                        Accept Shipment
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleRejectOrder(selectedOrder.id)}
                        className="w-full rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 font-bold h-11 text-xs"
                      >
                        Decline Shipment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Fulfillment checkpoint:</span>
                      <div className="grid gap-2">
                        {[
                          { key: 'vendor_accepted', label: '✓ Vendor Accepted' },
                          { key: 'packed', label: '📦 Mark Packed' },
                          { key: 'shipped', label: '🚢 Mark Shipped' },
                          { key: 'out_for_delivery', label: '🚚 Out for Delivery' },
                          { key: 'delivered', label: '✅ Mark Delivered' }
                        ].map(st => (
                          <Button
                            key={st.key}
                            onClick={() => handleStatusUpdate(selectedOrder.id, st.key)}
                            variant={selectedOrder.status === st.key ? 'default' : 'outline'}
                            size="sm"
                            className={`w-full rounded-full text-xs font-bold h-10 ${
                              selectedOrder.status === st.key 
                                ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {st.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial cost breakdown sidebar */}
              <Card className="rounded-2xl border border-[#ECECEC] bg-white shadow-xs overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="font-display font-extrabold text-sm text-slate-800 mb-3">Cost Breakdown</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Subtotal</span>
                      <span className="font-semibold text-slate-800">{formatINR(subtotalVal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Shipping Fee</span>
                      <span className="font-semibold text-slate-800">{shippingVal === 0 ? 'FREE' : formatINR(shippingVal)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between font-display font-black text-sm text-slate-900">
                      <span>Grand Total</span>
                      <span>{formatINR(totalVal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

          </div>
        </div>
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
              <h1 className="font-display font-black text-sm text-slate-800 tracking-tight leading-none">AK Enterprises Vendor Portal</h1>
              <span className="text-[10px] text-muted-foreground font-bold mt-1 block">Logistics & Delivery Partner Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider leading-none">Logistics Unit</span>
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
            <h2 className="font-display font-black text-xl md:text-2xl tracking-tight">👋 Welcome back, {user?.full_name || 'Delivery Partner'}</h2>
            <p className="text-xs text-slate-400 font-medium">
              You have <strong className="text-white">{stats.pending} orders</strong> awaiting acceptance and <strong className="text-white">{stats.active} shipments</strong> active in transit.
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
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Pending Orders</span>
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
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Active Deliveries</span>
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
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Delivered Shipments</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.delivered}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab switcher navigation exactly as requested */}
        <div className="flex bg-white p-1 rounded-full border border-[#ECECEC] max-w-md shadow-xs">
          <button
            onClick={() => { setActiveTab('orders'); setStatusFilter('all') }}
            className={`flex-1 py-2 px-4 rounded-full font-bold text-xs transition ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Assigned Orders ({orders.length})
          </button>
          <button
            onClick={() => { setActiveTab('inventory'); setStatusFilter('all') }}
            className={`flex-1 py-2 px-4 rounded-full font-bold text-xs transition ${activeTab === 'inventory' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Stock Inventory ({inventory.length})
          </button>
          <button
            onClick={() => { setActiveTab('performance'); setStatusFilter('all') }}
            className={`flex-1 py-2 px-4 rounded-full font-bold text-xs transition ${activeTab === 'performance' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Performance &amp; Reports
          </button>
        </div>

        {/* Feed lists tabs */}
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
                    <SelectValue placeholder="All Orders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="vendor_assigned">Assigned</SelectItem>
                    <SelectItem value="vendor_accepted">Accepted</SelectItem>
                    <SelectItem value="packed">Packed</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchVendorOrders} className="rounded-full h-10 text-xs px-4">
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
                </Button>
              </div>
            </div>

            {/* Render Orders list */}
            {loadingOrders ? (
              <div className="text-center py-16 text-xs text-slate-400 font-semibold animate-pulse">Syncing shipments database...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white border border-[#ECECEC] rounded-2xl py-16 text-center text-xs text-slate-400 font-bold shadow-xs">
                No assigned shipments found matching selection.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredOrders.map(o => {
                  const totalItems = o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0
                  return (
                    <Card key={o.id} className="bg-white border border-[#ECECEC] hover:border-slate-300 transition-all rounded-3xl shadow-sm overflow-hidden">
                      <CardContent className="p-6 space-y-4">
                        
                        {/* Upper status checkpoint triggers */}
                        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-800">Order #{o.order_number}</span>
                              <Badge className={`capitalize font-bold text-[9px] rounded-full px-2.5 py-0.5 ${CHECKPOINT_COLORS[o.status] || 'bg-slate-100 text-slate-600'}`}>
                                {o.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">Assigned on {new Date(o.placed_at).toLocaleDateString('en-IN')}</span>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] text-slate-400 font-bold mr-1">Update Status:</span>
                            {o.status === 'vendor_assigned' ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleAcceptOrder(o.id)} className="h-8 text-xs font-bold rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4">
                                  Accept
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRejectOrder(o.id)} className="h-8 text-xs font-bold rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 px-4">
                                  Decline
                                </Button>
                              </div>
                            ) : (
                              ['vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered'].map(st => (
                                <Button
                                  key={st}
                                  size="sm"
                                  onClick={() => handleStatusUpdate(o.id, st)}
                                  variant={o.status === st ? 'default' : 'outline'}
                                  className={`h-8 text-[10px] font-bold rounded-full capitalize px-3 ${
                                    o.status === st 
                                      ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                      : 'border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {st.replace(/_/g, ' ')}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Mid columns info split */}
                        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4">
                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Shipping Address & Contact</span>
                            <p className="font-black text-slate-800 text-sm mt-2">{o.address?.full_name}</p>
                            <p className="text-slate-500 font-bold">📞 Phone: {o.address?.phone}</p>
                            <p className="text-slate-500 leading-relaxed font-medium">
                              {o.address?.line1}, {o.address?.line2 && o.address.line2 + ', '}{o.address?.city}, {o.address?.state} — <strong className="text-slate-700">{o.address?.pincode}</strong>
                            </p>
                          </div>

                          <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-3 text-xs flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>Dispatch Items ({o.items?.length || 0})</span>
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
                              <span className="font-black text-base text-[#F4B942]">{formatINR(o.total_amount)}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedOrderId(o.id)} 
                                className="h-8 text-xs font-bold text-slate-900 hover:bg-slate-100 rounded-full"
                              >
                                View Complete Details &rarr;
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

        {/* Stock Inventory Tab content with premium progress bars */}
        {activeTab === 'inventory' && (
          <div className="space-y-4 slide-up">
            
            <div className="bg-white p-6 border border-[#ECECEC] rounded-3xl shadow-xs">
              <h2 className="font-display font-black text-sm text-slate-800">Warehouse Stock Inventory</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Read-only warehouse level inventory allocations and custom stock warnings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {inventory.map(p => {
                const isLow = p.stock_quantity <= 10
                const percent = Math.min(100, Math.round((p.stock_quantity / 1200) * 100))

                return (
                  <Card key={p.id} className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs p-5 space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{p.name}</h4>
                        <span className="text-[9px] text-slate-400 font-mono">SKU: {p.sku || 'N/A'}</span>
                      </div>
                      <Badge className={`font-bold text-[9px] rounded-full px-2 py-0.5 ${isLow ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                        {isLow ? 'Restock Soon' : 'In Stock'}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Allocated Level</span>
                        <span>{p.stock_quantity} pcs</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${isLow ? 'bg-rose-500' : 'bg-[#F4B942]'}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

          </div>
        )}

        {/* Performance & Reports Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6 slide-up">
            <div className="bg-white p-6 border border-[#ECECEC] rounded-3xl shadow-xs">
              <h2 className="font-display font-black text-sm text-slate-800">Performance Analytics &amp; Reports</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Generate logistics summaries and download official fulfillment data sheets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border border-[#ECECEC] rounded-2xl shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Vendor summary Report</h3>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">Comprehensive review of your orders, revenue, stats, and deliveries for the last 6 months.</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700 block">Period</span>
                    Last 6 Months
                  </div>
                  <Button
                    onClick={handleExportReport}
                    disabled={exportingReport}
                    className="rounded-full text-xs font-bold px-5 bg-slate-950 text-white hover:bg-slate-800 h-10 shadow-xs flex items-center gap-1.5"
                  >
                    {exportingReport ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" /> Export Last 6 Months Report
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
