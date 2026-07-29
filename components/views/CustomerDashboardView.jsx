'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Grid3x3, Clock, PackageCheck, CheckCircle2, MessageCircle, ChevronRight, Heart, User, HeadphonesIcon, ShoppingBag, ArrowRight, Truck, Award, Sparkles, FileText, BatteryCharging, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAppContext } from '@/components/providers/AppProvider'
import { useRealtimeOrders, useRealtimePricing } from '@/lib/hooks/useRealtime'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export function CustomerDashboardView({ user }) {
  const { cart, addToCart } = useAppContext()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [moq, setMoq] = useState(6000)
  const [catalogLocked, setCatalogLocked] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    try {
      const [prodRes, orderRes] = await Promise.all([
        fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      ])

      if (prodRes.ok) {
        const pData = await prodRes.json()
        if (pData.catalog_locked || !pData.products || pData.products.length === 0) {
          setCatalogLocked(true)
        } else {
          setCatalogLocked(false)
          setProducts(pData.products)
        }
      }

      if (orderRes.ok) {
        const oData = await orderRes.json()
        setOrders(Array.isArray(oData) ? oData : [])
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeOrders(loadDashboard)
  useRealtimePricing(loadDashboard)

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (catalogLocked || (!loading && products.length === 0)) {
    return <CatalogAccessPending user={user} />
  }

  const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length
  const shippedCount = orders.filter(o => ['shipped', 'out_for_delivery', 'vendor_assigned', 'vendor_accepted', 'packed'].includes(o.status)).length
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const totalOrders = orders.length

  const recentOrders = orders.slice(0, 5)

  const recentlyViewed = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('recentlyViewed') || '[]').slice(0, 4)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Welcome Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mesh-hero rounded-3xl p-8 md:p-10 text-primary-foreground relative overflow-hidden">
        <div className="relative z-10">
          <Badge className="mb-4 bg-accent/20 text-accent border-accent/40 px-3.5 py-1 text-xs font-bold uppercase tracking-widest">Customer Dashboard</Badge>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3">
            Hello, <span className="gold-shine">{user.full_name || user.email}</span>
          </h1>
          <p className="text-primary-foreground/80 text-base md:text-lg max-w-2xl">
            Welcome to your B2B procurement hub. Manage orders, track shipments, and reorder supplies.
          </p>
          <div className="flex flex-wrap gap-4 mt-6 text-xs font-semibold">
            <div className="bg-white/10 backdrop-blur border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-accent" />
              <span>{products.length} Products in Your Catalog</span>
            </div>
            <div className="bg-white/10 backdrop-blur border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>{pendingCount + shippedCount} Orders in Progress</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Browse Products', icon: Grid3x3, href: '/products', color: 'gold-gradient text-primary' },
          { label: 'My Orders', icon: ShoppingBag, href: '/orders', color: 'bg-blue-500/10 text-blue-600' },
          { label: 'Wishlist', icon: Heart, href: '/wishlist', color: 'bg-red-500/10 text-red-500' },
          { label: 'My Profile', icon: User, href: '/account', color: 'bg-purple-500/10 text-purple-600' },
          { label: 'Support', icon: HeadphonesIcon, href: '/contact', color: 'bg-emerald-500/10 text-emerald-600' }
        ].map((item, i) => (
          <Link key={i} href={item.href} className="group bg-card border border-border/80 rounded-2xl p-5 text-left hover:border-accent/50 transition-all duration-300 shadow-soft hover:shadow-glow">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="font-bold text-sm text-foreground group-hover:text-accent transition-colors">{item.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* Order Stats & Recent Orders */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Status Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-1">
          <Card className="radius-xl shadow-soft border border-border/70">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-5">Order Status</h3>
              <div className="space-y-4">
                {[
                  { label: 'Total Orders', count: totalOrders, icon: ShoppingBag, color: 'text-foreground bg-secondary' },
                  { label: 'Active Orders', count: pendingCount + shippedCount, icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
                  { label: 'Shipped / In Transit', count: shippedCount, icon: Truck, color: 'text-purple-500 bg-purple-500/10' },
                  { label: 'Delivered', count: deliveredCount, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' }
                ].map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      </div>
                      <span className="font-display font-extrabold text-xl">{item.count}</span>
                    </div>
                  )
                })}
              </div>
              <Link href="/orders" className="mt-5 flex items-center justify-center gap-1 text-xs font-bold text-accent hover:underline pt-4 border-t border-border/50">
                View All Orders <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Orders Timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="radius-xl shadow-soft border border-border/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-extrabold text-lg">Recent Orders</h3>
                <Link href="/orders" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No orders yet</p>
                  <p className="text-xs mt-1">Browse products and place your first order.</p>
                  <Link href="/products">
                    <Button size="sm" className="mt-4 rounded-full gold-gradient text-primary font-bold">Browse Products</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order, i) => (
                    <Link key={order.id} href={`/orders/${order.id}`} className="block p-4 rounded-xl bg-secondary/20 hover:bg-secondary/40 border border-border/50 transition group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            order.status === 'delivered' ? 'bg-emerald-500' :
                            order.status === 'shipped' || order.status === 'out_for_delivery' ? 'bg-purple-500' :
                            order.status === 'packed' || order.status === 'vendor_accepted' ? 'bg-blue-500' :
                            'bg-amber-500'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              Order #{order.order_number || order.id?.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {order.status?.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-foreground">{formatINR(order.total || order.total_amount || 0)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {order.placed_at ? new Date(order.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recently Viewed Products */}
      {recentlyViewed.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="radius-xl shadow-soft border border-border/70">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-5">Recently Viewed</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentlyViewed.map((p, i) => (
                  <Link key={i} href={`/product/${p.slug}`} className="group block">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary mb-2">
                      <Image src={p.images?.[0] || p.image_url || '/placeholder.png'} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 25vw" />
                    </div>
                    <p className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors">{p.name}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* Featured Categories */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl font-extrabold">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Office Stationery', slug: 'office-stationery', icon: FileText, img: '/category-stationery.jpg', desc: 'Pens, paper, files & more' },
            { name: 'Housekeeping', slug: 'housekeeping', icon: Sparkles, img: '/category-housekeeping.jpg', desc: 'Cleaning & janitorial supplies' },
            { name: 'UPS Solutions', slug: 'ups-solutions', icon: BatteryCharging, img: '/category-ups.jpg', desc: 'Power backup & industrial UPS' }
          ].map((cat, i) => (
            <Link key={i} href={`/products?category=${cat.slug}`} className="group relative h-44 rounded-2xl overflow-hidden shadow-soft">
              <Image src={cat.img} alt={cat.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/40" />
              <div className="absolute inset-0 p-5 flex items-center gap-4">
                <div className="w-11 h-11 gold-gradient rounded-xl flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                  <cat.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-white">{cat.name}</h3>
                  <p className="text-xs text-white/70">{cat.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* Assigned Products Preview */}
      {products.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl font-extrabold">Your Products</h2>
            <Link href="/products" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
              View All ({products.length}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.slice(0, 8).map(p => (
              <Link key={p.id} href={`/product/${p.slug}`} className="group block bg-card border border-border/70 rounded-2xl p-4 hover:shadow-soft transition-all">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary mb-3">
                  <Image src={p.images?.[0] || p.image_url || '/placeholder.png'} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 25vw" />
                </div>
                <p className="text-xs font-bold text-foreground line-clamp-2 mb-1">{p.name}</p>
                <p className="font-mono font-extrabold text-sm text-primary">{formatINR(p.price)}</p>
              </Link>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  )
}

function CatalogAccessPending({ user }) {
  const whatsappRequestText = encodeURIComponent(
    `Hello AK Enterprises, my account is ${user.full_name || user.email} (${user.phone || ''}). I would like to request catalog access and custom pricing for my corporate account.`
  )
  const whatsappUrl = `https://wa.me/918308860894?text=${whatsappRequestText}`

  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-10 h-10" />
      </div>
      <h2 className="font-display text-3xl font-extrabold mb-3">Catalog Access Pending</h2>
      <p className="text-muted-foreground mb-6">
        Your product catalog is being configured. Please contact our procurement team via WhatsApp to request access.
      </p>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <Button size="lg" className="rounded-full px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
          <MessageCircle className="w-5 h-5 mr-2" /> Contact Procurement Team
        </Button>
      </a>
    </div>
  )
}
