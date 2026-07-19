'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, ArrowLeft, ChevronRight, ShoppingBag, Calendar, CreditCard } from 'lucide-react'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const STATUS_THEMES = {
  confirmed: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
  shipped: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
  'out for delivery': 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  cancelled: 'bg-destructive/10 text-destructive border border-destructive/20',
  returned: 'bg-stone-500/10 text-stone-600 border border-stone-500/20',
  pending: 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
}

export function OrdersView() {
  const { user } = useAppContext()
  const router = useRouter()
  const [orders, setOrders] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all, delivered, cancelled, returned
  const [mounted, setMounted] = useState(false)

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (e) {
      console.error(e)
      setOrders([])
    }
  }

  useEffect(() => {
    setMounted(true)
    if (mounted && !user) {
      router.push('/login?redirect=/orders')
      return
    }
    if (user) {
      fetchOrders()
    }
  }, [user, mounted])

  const filteredOrders = useMemo(() => {
    if (!orders) return []
    let list = [...orders]

    // Tab filtering
    if (activeTab === 'delivered') {
      list = list.filter(o => o.status === 'delivered')
    } else if (activeTab === 'cancelled') {
      list = list.filter(o => o.status === 'cancelled')
    } else if (activeTab === 'returned') {
      list = list.filter(o => o.status === 'returned')
    }

    // Search query filtering (by product name or order number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      list = list.filter(o => 
        o.order_number.toLowerCase().includes(query) ||
        o.items?.some(it => it.product_name_snapshot.toLowerCase().includes(query))
      )
    }

    return list
  }, [orders, activeTab, searchQuery])

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/account" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">My Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Track shipping and review purchase history</p>
          </div>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search orders by product name or order ID..."
            className="pl-10 h-11 bg-secondary/30 border-transparent rounded-xl focus-visible:bg-background focus-visible:border-border transition-all"
          />
        </div>
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'returned', label: 'Returned' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${activeTab === tab.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-transparent text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {!orders ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 border rounded-3xl border-dashed border-border/85 bg-secondary/15">
          <div className="max-w-xs mx-auto">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/35 mx-auto mb-4" />
            <p className="font-display font-extrabold text-xl mb-1">No orders found</p>
            <p className="text-xs text-muted-foreground mb-6">
              {searchQuery ? 'Try checking your spelling or search terms' : 'You have not placed any orders yet.'}
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={() => router.push('/products')} className="rounded-full">
                Explore Products
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(o => {
            const firstItem = o.items?.[0]
            const remainingCount = (o.items?.length || 0) - 1
            const statusTheme = STATUS_THEMES[o.status.toLowerCase()] || STATUS_THEMES.pending
            
            return (
              <Card 
                key={o.id}
                onClick={() => router.push(`/orders/${o.id}`)}
                className="group border border-border/50 hover:border-accent/40 rounded-2xl bg-card hover:shadow-soft transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <CardContent className="p-5 md:p-6">
                  {/* Order Top Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-border/30">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold bg-secondary/70 text-foreground/90 px-2.5 py-1 rounded-md">
                        {o.order_number}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Ordered {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusTheme}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>

                  {/* Order Content */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-4">
                      {firstItem && (
                        <div className="relative w-16 h-18 rounded-xl overflow-hidden bg-secondary/40 shrink-0 border border-border/20">
                          <Image 
                            src={firstItem.image || '/placeholder.png'} 
                            alt={firstItem.product_name_snapshot}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            sizes="64px"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm line-clamp-1 text-foreground leading-snug group-hover:text-primary transition-colors">
                          {firstItem?.product_name_snapshot || 'Bulk Order'}
                        </h4>
                        <p className="text-xs text-muted-foreground font-medium">
                          Qty {firstItem?.quantity} · {formatINR(firstItem?.price_snapshot)}
                        </p>
                        {remainingCount > 0 && (
                          <p className="text-[10px] font-bold text-accent bg-accent/5 border border-accent/15 px-2 py-0.5 rounded-md w-fit mt-1">
                            + {remainingCount} other item{remainingCount > 1 ? 's' : ''} in this order
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-border/30 shrink-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Amount</p>
                        <p className="font-display font-extrabold text-xl text-foreground mt-0.5">{formatINR(o.total)}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-secondary/50 group-hover:bg-primary flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4 text-foreground group-hover:text-primary-foreground transition-all group-hover:translate-x-0.5" />
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
  )
}
