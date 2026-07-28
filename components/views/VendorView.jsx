'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, Package, MapPin, Phone, User, CheckCircle2, Clock, RefreshCw, LogOut, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppContext } from '@/components/providers/AppProvider'

import { useRealtimeOrders } from '@/lib/hooks/useRealtime'

export function VendorView() {
  const { user, setUser } = useAppContext()
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchVendorOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendor/orders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(data || [])
      } else {
        toast.error('Failed to load assigned orders')
      }
    } catch {
      toast.error('Error fetching orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeOrders(fetchVendorOrders)

  useEffect(() => {
    if (user && user.role !== 'vendor') {
      toast.error('Vendor access required')
      router.push('/login')
      return
    }
    fetchVendorOrders()
  }, [user, router, fetchVendorOrders])

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const res = await fetch('/api/vendor/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ order_id: orderId, status: newStatus })
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
    router.push('/login')
  }

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true
    return o.status === statusFilter
  })

  return (
    <div className="min-h-screen bg-secondary/20 text-left">
      {/* Top Banner Header */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-soft">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-lg text-white">Vendor Fulfillment Portal</h1>
            <p className="text-xs text-slate-400">Logistics & Delivery Partner Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-300 hidden sm:inline">
            Logged in: <strong className="text-white">{user?.full_name || user?.email}</strong>
          </span>
          <Button size="sm" variant="outline" onClick={logout} className="border-slate-700 text-slate-200 hover:bg-slate-800 rounded-xl">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">Assigned Delivery Orders</h2>
            <p className="text-xs text-muted-foreground">View and update dispatch status for orders assigned to your logistics unit.</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl h-10 bg-card text-xs">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="packed">Packed</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="out for delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={fetchVendorOrders} className="rounded-xl h-10">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Loading assigned delivery orders...</div>
        ) : filteredOrders.length === 0 ? (
          <Card className="radius-xl shadow-soft text-center py-16">
            <CardContent>
              <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-display font-bold text-lg text-foreground mb-1">No assigned orders found</h3>
              <p className="text-xs text-muted-foreground">You currently have no orders matching this filter.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map(o => (
              <Card key={o.id} className="radius-xl shadow-soft border border-border bg-card overflow-hidden">
                <CardContent className="p-6">
                  {/* Order Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-lg text-foreground">Order #{o.order_number}</span>
                        <Badge className={`capitalize font-bold px-3 py-1 rounded-full ${
                          o.status === 'delivered' ? 'bg-emerald-600 text-white' :
                          o.status === 'shipped' || o.status === 'out for delivery' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {o.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Assigned on {new Date(o.placed_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    {/* Fulfillment Status Actions */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground mr-1">Update Status:</span>
                      {['packed', 'shipped', 'out for delivery', 'delivered'].map(st => (
                        <Button
                          key={st}
                          size="sm"
                          variant={o.status === st ? 'default' : 'outline'}
                          onClick={() => handleStatusUpdate(o.id, st)}
                          className="capitalize rounded-xl text-xs h-8 font-semibold"
                        >
                          {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Order Details Grid: Customer Info & Items */}
                  <div className="grid md:grid-cols-2 gap-6 pt-4">
                    {/* Delivery Customer Details */}
                    <div className="bg-secondary/30 p-4 rounded-2xl border text-xs space-y-2">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-blue-600" /> Shipping Address & Contact
                      </h4>
                      <p className="font-bold text-foreground text-sm">{o.address?.full_name}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-accent" /> Phone: <strong className="text-foreground">{o.address?.phone}</strong>
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        {o.address?.line1}{o.address?.line2 ? `, ${o.address?.line2}` : ''}, {o.address?.city}, {o.address?.state} — <strong className="text-foreground">{o.address?.pincode}</strong>
                      </p>
                    </div>

                    {/* Order Line Items (Quantities ONLY - NO Financial Data Exposed) */}
                    <div className="bg-secondary/30 p-4 rounded-2xl border text-xs">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-blue-600" /> Dispatch Items ({o.items?.length || 0})
                      </h4>
                      <div className="divide-y divide-border/60 max-h-40 overflow-y-auto pr-1 space-y-2">
                        {o.items?.map((it, idx) => (
                          <div key={idx} className="pt-2 flex justify-between items-center text-xs">
                            <span className="font-semibold text-foreground line-clamp-1">{it.product_name_snapshot}</span>
                            <Badge variant="outline" className="font-mono font-extrabold text-blue-600 bg-blue-50 border-blue-200 shrink-0 ml-2">
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
      </main>
    </div>
  )
}
