'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, Package, MapPin, Phone, RefreshCw, LogOut, Layers, Search, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppContext } from '@/components/providers/AppProvider'
import { useRealtimeOrders } from '@/lib/hooks/useRealtime'

export function VendorView() {
  const { user, setUser } = useAppContext()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'inventory'
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [inventorySearch, setInventorySearch] = useState('')
  const [authReady, setAuthReady] = useState(false)

  // 1. Fetch Vendor Assigned Orders
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
      } else if (res.status === 500) {
        console.error('[Vendor Orders HTTP 500 Fail]')
        toast.error('Server error loading assigned orders')
      }
    } catch (e) {
      console.error('[Vendor Orders Exception]:', e)
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
      } else if (res.status === 500) {
        console.error('[Vendor Inventory HTTP 500 Fail]')
      }
    } catch (e) {
      console.error('[Vendor Inventory Exception]:', e)
    } finally {
      setLoadingInventory(false)
    }
  }, [])

  useRealtimeOrders(fetchVendorOrders)

  // Auth guard: Wait for localStorage to be available (client-side hydration)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let parsedRole = null
    try { parsedRole = storedUser ? JSON.parse(storedUser)?.role : null } catch {}

    if (!token || (parsedRole && parsedRole !== 'vendor' && parsedRole !== 'admin')) {
      // No token at all — redirect to vendor login
      router.replace('/vendor/login')
      return
    }
    setAuthReady(true)
  }, [router])

  useEffect(() => {
    if (!authReady) return
    // Extra check once user state is loaded from AppProvider
    if (user && user.role !== 'vendor' && user.role !== 'admin') {
      toast.error('Vendor access required')
      router.replace('/vendor/login')
      return
    }
    fetchVendorOrders()
    fetchInventory()
  }, [authReady, user, router, fetchVendorOrders, fetchInventory])

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
        toast.success('Order Accepted! Admin & Customer notified in Realtime.')
        fetchVendorOrders()
      } else {
        toast.error('Failed to accept order')
      }
    } catch {
      toast.error('Failed to accept order')
    }
  }

  const handleRejectOrder = async (orderId) => {
    if (!confirm('Are you sure you want to decline this dispatch request?')) return
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
        toast.info('Dispatch request declined. Admin notified.')
        fetchVendorOrders()
      } else {
        toast.error('Failed to update request status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

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
        toast.success(`Order status updated to ${newStatus.toUpperCase()}`)
        fetchVendorOrders()
      } else {
        toast.error('Failed to update order status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'user_role=; path=/; max-age=0'
    document.cookie = 'auth_token=; path=/; max-age=0'
    router.push('/vendor/login')
    toast.success('Signed out of Vendor Portal')
  }

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true
    return o.status === statusFilter
  })

  const filteredInventory = inventory.filter(p => {
    if (!inventorySearch) return true
    const q = inventorySearch.toLowerCase()
    const catStr = (p.category || p.subcategory || '').toLowerCase()
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || catStr.includes(q)
  })

  return (
    <div className="min-h-screen bg-background text-foreground text-left">
      {/* Light Banner Header — Matching Admin & Customer Site Header */}
      <header className="bg-card border-b border-border px-4 md:px-8 py-4 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center font-bold text-primary shadow-soft">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg text-foreground tracking-tight">Vendor Fulfillment Portal</h1>
              <p className="text-xs text-accent font-semibold">Logistics & Delivery Partner Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline-block bg-secondary px-3.5 py-1.5 rounded-full border border-border">
              Partner: <strong className="text-foreground">{user?.full_name || user?.email}</strong>
            </span>
            <Button size="sm" variant="outline" onClick={logout} className="rounded-xl h-9 text-xs">
              <LogOut className="w-4 h-4 mr-1.5 text-destructive" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Navigation Tabs — Light Card Styling */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
              activeTab === 'orders'
                ? 'gold-gradient text-primary shadow-soft'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:bg-secondary/50'
            }`}
          >
            <Package className="w-4 h-4" /> Assigned Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
              activeTab === 'inventory'
                ? 'gold-gradient text-primary shadow-soft'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:bg-secondary/50'
            }`}
          >
            <Layers className="w-4 h-4" /> Stock Inventory ({inventory.length})
          </button>
        </div>

        {/* TAB 1: ASSIGNED DELIVERY ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold text-foreground">Assigned Delivery Orders</h2>
                <p className="text-xs text-muted-foreground">View customer shipping addresses, quantities, and update dispatch status live.</p>
              </div>

              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44 rounded-xl h-10 bg-card border-border text-xs text-foreground focus:ring-amber-500">
                    <SelectValue placeholder="Status Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="vendor_assigned">Vendor Assigned</SelectItem>
                    <SelectItem value="vendor_accepted">Vendor Accepted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="packed">Packed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={fetchVendorOrders} className="rounded-xl h-10 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
              </div>
            </div>

            {loadingOrders ? (
              <div className="py-24 text-center text-sm text-muted-foreground">Loading assigned delivery orders...</div>
            ) : filteredOrders.length === 0 ? (
              <Card className="radius-xl shadow-soft text-center py-16">
                <CardContent>
                  <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="font-display font-bold text-lg text-foreground mb-1">No assigned orders found</h3>
                  <p className="text-xs text-muted-foreground">You currently have no delivery orders assigned to your logistics unit.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(o => (
                  <Card key={o.id} className="radius-xl shadow-soft border border-border overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      {/* Vendor Acceptance Banner */}
                      {!o.vendor_accepted && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
                            <AlertCircle className="w-4 h-4 text-accent shrink-0" />
                            <span><strong>Dispatch Request Pending:</strong> Admin has assigned this order to your logistics unit. Please confirm acceptance.</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptOrder(o.id)}
                              className="gold-gradient text-primary font-extrabold text-xs h-9 px-4 rounded-xl shadow-soft flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Accept Delivery Request
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectOrder(o.id)}
                              className="border-destructive/30 text-destructive hover:bg-destructive/10 font-bold text-xs h-9 px-3 rounded-xl"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Order Header */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-lg text-foreground">Order #{o.order_number}</span>
                            <Badge className={`capitalize font-bold px-3 py-1 rounded-full ${
                              o.status === 'delivered' ? 'bg-emerald-600 text-white' :
                              o.status === 'shipped' || o.status === 'out_for_delivery' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30' : 'gold-gradient text-primary'
                            }`}>
                              {o.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned on {new Date(o.placed_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>

                        {/* Status Update Buttons — Gold CTA Active States */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground mr-1">Update Status:</span>
                          {['packed', 'shipped', 'out_for_delivery', 'delivered'].map(st => (
                            <Button
                              key={st}
                              size="sm"
                              variant={o.status === st ? 'default' : 'outline'}
                              onClick={() => handleStatusUpdate(o.id, st)}
                              className={`capitalize rounded-xl text-xs h-8 font-extrabold ${
                                o.status === st
                                  ? 'gold-gradient text-primary shadow-soft'
                                  : 'border-border bg-card text-foreground hover:bg-secondary'
                              }`}
                            >
                              {st.replace(/_/g, ' ')}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Customer Address & Dispatch Items Grid */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-secondary/40 p-4 rounded-xl border border-border text-xs space-y-2">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-accent" /> Shipping Address & Contact
                          </h4>
                          <p className="font-bold text-foreground text-sm">{o.address?.full_name}</p>
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-accent" /> Phone: <strong className="text-foreground">{o.address?.phone}</strong>
                          </p>
                          <p className="text-muted-foreground leading-relaxed">
                            {o.address?.line1}{o.address?.line2 ? `, ${o.address?.line2}` : ''}, {o.address?.city}, {o.address?.state} — <strong className="text-foreground">{o.address?.pincode}</strong>
                          </p>
                        </div>

                        <div className="bg-secondary/40 p-4 rounded-xl border border-border text-xs">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-accent" /> Dispatch Items ({o.items?.length || 0})
                          </h4>
                          <div className="divide-y divide-border max-h-36 overflow-y-auto pr-1 space-y-2">
                            {o.items?.map((it, idx) => (
                              <div key={idx} className="pt-2 flex justify-between items-center text-xs">
                                <span className="font-semibold text-foreground line-clamp-1">{it.product_name_snapshot}</span>
                                <Badge variant="outline" className="font-mono font-extrabold text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/20 shrink-0 ml-2">
                                  Qty {it.quantity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STOCK INVENTORY (READ ONLY) */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold text-foreground">Stock Inventory</h2>
                <p className="text-xs text-muted-foreground">Read-only view of current warehouse inventory and stock levels.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Search product or SKU..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-card border-border text-xs text-foreground focus:ring-amber-500"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchInventory} className="rounded-xl h-10 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {loadingInventory ? (
              <div className="py-24 text-center text-sm text-muted-foreground">Loading stock inventory...</div>
            ) : filteredInventory.length === 0 ? (
              <Card className="radius-xl shadow-soft text-center py-16">
                <CardContent>
                  <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="font-display font-bold text-lg text-foreground mb-1">No products found</h3>
                  <p className="text-xs text-muted-foreground">No inventory matches your search criteria.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map((p) => {
                  const isLow = p.stock_quantity <= (p.min_stock_alert || 5)
                  const isOut = p.stock_quantity === 0

                  return (
                    <Card key={p.id} className="radius-xl shadow-soft border border-border p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground line-clamp-1">{p.name}</h4>
                          <span className="text-[11px] text-muted-foreground font-mono">SKU: {p.sku || 'N/A'}</span>
                        </div>
                        <Badge className={`capitalize font-bold text-[10px] ${
                          isOut ? 'bg-destructive text-destructive-foreground' : isLow ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30' : 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-border text-xs">
                        <span className="text-muted-foreground capitalize">Category: <strong className="text-foreground">{p.category || p.subcategory || 'General'}</strong></span>
                        <div className="text-right">
                          <span className="text-muted-foreground text-[10px] block">Stock Level</span>
                          <strong className="text-accent font-mono font-extrabold text-sm">{p.stock_quantity} units</strong>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
