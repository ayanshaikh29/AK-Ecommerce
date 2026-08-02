'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { 
  LayoutDashboard, Grid3x3, Plus, Upload, ClipboardList, ImageIcon, 
  Users, Settings, LogOut, Package, TrendingUp, AlertTriangle, 
  Trash2, Video, FileText, Building2, Bell, BellRing, Menu, X, MessageSquare,
  Loader2, ShieldCheck, Truck, CheckCircle2, XCircle, Activity, Search
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { INDIAN_STATES } from '@/lib/constants/indian-states'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppContext } from '@/components/providers/AppProvider'

import { CustomerPricingManager } from './CustomerPricingManager'
import { InventoryManager } from './InventoryManager'
import { VendorManager } from './VendorManager'
import { BillingManager } from './BillingManager'
import { AdminHeaderNotifications } from './AdminHeaderNotifications'
import { AdminToastFeed } from './AdminToastFeed'
import { AdminLiveActivityFeed } from './AdminLiveActivityFeed'
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary'
import { useLiveCustomers } from '@/lib/hooks/useAdminRealtime'
import { useRealtimeOrders, useRealtimeDashboard } from '@/lib/hooks/useRealtime'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Admin Panel Exception caught by ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-card border radius-xl shadow-soft max-w-xl mx-auto my-12 text-left slide-up">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-display font-extrabold text-xl mb-2 text-foreground">Something went wrong in this section</h3>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            An unexpected client-side error occurred while rendering this section ({this.state.error?.message || 'Client Exception'}).
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="rounded-xl font-bold text-xs gold-gradient text-primary"
            >
              Retry & Reload Page
            </Button>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-xl text-xs"
            >
              Dismiss Error
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function AdminMarquee() {
  return (
    <div className="bg-primary text-primary-foreground text-xs py-1.5 overflow-hidden">
      <div className="flex whitespace-nowrap marquee">
        {[1,2,3,4].map(i => (
          <span key={i} className="mx-4 font-semibold uppercase tracking-widest text-primary-foreground/70">
            Admin Panel — Authorized Access Only
          </span>
        ))}
      </div>
    </div>
  )
}

export function AdminApp() {
  const { user, setUser, setSettings } = useAppContext()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug || []
  const section = slug[0] || 'dashboard'
  const id = slug[1]
  
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [unreadOrders, setUnreadOrders] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [supabaseClient, setSupabaseClient] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // New Order Center-Screen Popup State
  const [activeOrderPopup, setActiveOrderPopup] = useState(null)
  const [popupCountdown, setPopupCountdown] = useState(5)

  // Auto-disappear countdown timer (5 seconds)
  useEffect(() => {
    if (!activeOrderPopup) return
    setPopupCountdown(5)
    const interval = setInterval(() => {
      setPopupCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setActiveOrderPopup(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activeOrderPopup])

  // Initialize client-side Supabase client for realtime updates
  useEffect(() => {
    if (!authChecked) return
    const initSupabase = async () => {
      try {
        const res = await fetch('/api/admin/supabase-key', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        if (res.ok) {
          const { supabaseUrl, supabaseKey } = await res.json()
          const client = createClient(supabaseUrl, supabaseKey)
          setSupabaseClient(client)
        }
      } catch (e) {
        console.error("Failed to initialize Supabase Realtime client:", e)
      }
    }
    initSupabase()
  }, [authChecked])

  // Clear sidebar orders unread badge when section is orders
  useEffect(() => {
    if (section === 'orders') {
      setUnreadOrders([])
    }
  }, [section])

  // Subscribe to realtime orders, catalog requests, and customer logins
  useEffect(() => {
    if (!supabaseClient) return
    
    const ordersChannel = supabaseClient
      .channel('realtime-admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newOrder = payload.new
          
          // Sound Cue respect to muted settings state
          const isSoundMuted = localStorage.getItem('admin_sound_muted') === 'true'
          if (!isSoundMuted) {
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext
              if (AudioCtx) {
                const ctx = new AudioCtx()
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
                gain.gain.setValueAtTime(0.15, ctx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start()
                osc.stop(ctx.currentTime + 0.4)
              }
            } catch (e) {}
          }

          let customerName = 'Customer'
          try {
            const { data: addr } = await supabaseClient.from('addresses').select('full_name').eq('id', newOrder.address_id).maybeSingle()
            if (addr?.full_name) customerName = addr.full_name
          } catch (e) {}

          const orderInfo = {
            id: newOrder.id,
            order_number: newOrder.order_number,
            customerName,
            total: newOrder.total,
            placed_at: newOrder.placed_at || new Date().toISOString()
          }

          toast.success(`🛒 New Order Received`, { 
            description: `Order #${newOrder.order_number} by ${customerName} for ₹${Number(newOrder.total || 0).toLocaleString('en-IN')}`
          })
          setUnreadOrders(prev => [{ ...newOrder, customerName }, ...prev])
          setActiveOrderPopup(orderInfo)
          setPopupCountdown(8) // Auto hide after 8 seconds
          setRefreshTrigger(prev => prev + 1)
        }
      )
      .subscribe()

    const catalogRequestsChannel = supabaseClient
      .channel('realtime-admin-catalog-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'catalog_requests' },
        async (payload) => {
          const req = payload.new
          const isSoundMuted = localStorage.getItem('admin_sound_muted') === 'true'
          if (!isSoundMuted) {
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext
              if (AudioCtx) {
                const ctx = new AudioCtx()
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(523.25, ctx.currentTime)
                osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15)
                gain.gain.setValueAtTime(0.12, ctx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start()
                osc.stop(ctx.currentTime + 0.4)
              }
            } catch (e) {}
          }

          toast.info(`Catalog Access Request from ${req.customer_name}!`, { description: `${req.email || req.phone}: ${req.note}` })
          setRefreshTrigger(prev => prev + 1)
        }
      )
      .subscribe()

    const customerLoginsChannel = supabaseClient
      .channel('realtime-admin-customer-logins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_logins' },
        async (payload) => {
          const login = payload.new
          toast.info(`${login.user_name} logged in`, { description: `Customer activity at ${new Date(login.login_at || Date.now()).toLocaleTimeString()}` })
          setRefreshTrigger(prev => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.customer_logins_data' },
        async (payload) => {
          const row = payload.new
          if (row?.marquee_messages?.length > 0) {
            const raw = row.marquee_messages[0]
            const login = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (login?.user_name) {
              toast.info(`${login.user_name} logged in`, { description: `Customer activity at ${new Date(login.login_at || Date.now()).toLocaleTimeString()}` })
              setRefreshTrigger(prev => prev + 1)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(ordersChannel)
      supabaseClient.removeChannel(catalogRequestsChannel)
      supabaseClient.removeChannel(customerLoginsChannel)
    }
  }, [supabaseClient])
  
  useEffect(() => { 
    const check = async () => { 
      setAuthError(null)
      const token = localStorage.getItem('token')
      if (!token) { 
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        document.cookie = 'user_role=; path=/; max-age=0'
        router.push('/login')
        return 
      } 
      try { 
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 6000)

        const res = await fetch('/api/auth/me', { 
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            toast.error('Session expired or access denied')
            setUser(null)
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            document.cookie = 'user_role=; path=/; max-age=0'
            router.push('/login')
            return
          }
          throw new Error(`Server returned status ${res.status}`)
        }

        const { user: u } = await res.json()
        if (u?.role !== 'admin') { 
          toast.error('Access denied: Admin role required')
          setUser(null) 
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          document.cookie = 'user_role=; path=/; max-age=0'
          router.push('/login') 
          return 
        } 
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
        document.cookie = 'user_role=admin; path=/; max-age=31536000'
        setAuthChecked(true) 
        setAuthError(null)
      } catch (err) { 
        console.error('Admin role check error:', err)
        if (err.name === 'AbortError') {
          setAuthError('Access check timed out. The server took too long to respond.')
        } else {
          setAuthError(err.message || 'Unable to verify admin access.')
        }
      } 
    } 
    check() 
  }, [router, setUser, retryCount])
  
  if (!authChecked) {
    if (authError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/10">
          <div className="max-w-md w-full bg-card border radius-xl p-6 shadow-soft text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-foreground">Access Check Failed</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{authError}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button 
                onClick={() => setRetryCount(prev => prev + 1)} 
                className="rounded-xl gold-gradient text-primary font-bold text-xs shadow-soft"
              >
                Retry
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setUser(null)
                  localStorage.removeItem('token')
                  localStorage.removeItem('user')
                  document.cookie = 'user_role=; path=/; max-age=0'
                  router.push('/login')
                }}
                className="rounded-xl text-xs"
              >
                Sign In Again
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-medium text-muted-foreground animate-pulse">Checking access...</div>
        </div>
      </div>
    )
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'user_role=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <AdminMarquee/>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity" onClick={() => setMobileMenuOpen(false)}>
          <aside className="w-64 mesh-dark text-white p-4 h-full flex flex-col justify-between animate-in slide-in-from-left duration-200" onClick={e => e.stopPropagation()}>
            <div>
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => { router.push('/'); setMobileMenuOpen(false) }} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl gold-gradient flex items-center justify-center font-display font-extrabold text-primary">AK</div>
                  <div className="text-left">
                    <div className="font-display font-extrabold text-white">AK Admin</div>
                    <div className="text-xs text-white/60">Control Panel</div>
                  </div>
                </button>
                <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <nav className="space-y-1">
              {[
                ['dashboard','Dashboard',LayoutDashboard],
                ['customer-pricing','Customers',ShieldCheck],
                ['orders','Orders',ClipboardList],
                ['inventory','Stock Inventory',Package],
                ['vendors','Zonal Admins',Truck],
                ['billing','Billing & Invoices',FileText],
                ['products','Products',Grid3x3],
                ['product-new','Add Product',Plus],
                ['reports','Sales Reports',TrendingUp],
                ['settings','Settings',Settings]
              ].map(([s,l,I]) => {
                const isActive = section === s || 
                  (s === 'products' && section === 'product-edit') ||
                  (s === 'product-new' && section === 'csv') ||
                  (s === 'settings' && ['faqs', 'chat-logs', 'customers', 'product-qa', 'clients', 'banners'].includes(section))

                return (
                  <button 
                    key={s} 
                    onClick={() => { router.push('/admin/' + s); setMobileMenuOpen(false) }} 
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition ${isActive ? 'gold-gradient text-primary font-bold shadow-soft' : 'text-white/80 hover:bg-white/10'}`}
                  >
                    <span className="flex items-center gap-2">
                      <I className="w-4 h-4"/>{l}
                    </span>
                    {s === 'orders' && unreadOrders.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[10px] rounded-full animate-bounce shadow-soft">
                        {unreadOrders.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
            </div>
            <button 
              onClick={() => { logout(); setMobileMenuOpen(false) }} 
              className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 mb-4"
            >
              <LogOut className="w-4 h-4"/>Sign out
            </button>
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="w-64 shrink-0 mesh-dark text-white p-4 hidden md:flex md:flex-col justify-between h-screen sticky top-0 z-30 overflow-y-auto">
          <div>
            <div className="mb-8">
              <button onClick={() => router.push('/')} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl gold-gradient flex items-center justify-center font-display font-extrabold text-primary">AK</div>
                <div className="text-left">
                  <div className="font-display font-extrabold">AK Admin</div>
                  <div className="text-xs text-white/60">Control Panel</div>
                </div>
              </button>
            </div>
            <nav className="space-y-1">
              {[
                ['dashboard','Dashboard',LayoutDashboard],
                ['customer-pricing','Customers',ShieldCheck],
                ['orders','Orders',ClipboardList],
                ['inventory','Stock Inventory',Package],
                ['vendors','Zonal Admins',Truck],
                ['billing','Billing & Invoices',FileText],
                ['products','Products',Grid3x3],
                ['product-new','Add Product',Plus],
                ['reports','Sales Reports',TrendingUp],
                ['settings','Settings',Settings]
              ].map(([s,l,I]) => {
                const isActive = section === s || 
                  (s === 'products' && section === 'product-edit') ||
                  (s === 'product-new' && section === 'csv') ||
                  (s === 'settings' && ['faqs', 'chat-logs', 'customers', 'product-qa', 'clients', 'banners'].includes(section))

                return (
                  <button 
                    key={s} 
                    onClick={() => router.push('/admin/' + s)} 
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition ${isActive ? 'gold-gradient text-primary font-bold shadow-soft' : 'text-white/80 hover:bg-white/10'}`}
                  >
                    <span className="flex items-center gap-2">
                      <I className="w-4 h-4"/>{l}
                    </span>
                    {s === 'orders' && unreadOrders.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[10px] rounded-full animate-bounce shadow-soft">
                        {unreadOrders.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
          <button onClick={logout} className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 mt-6 mb-2"><LogOut className="w-4 h-4"/>Sign out</button>
        </aside>
        <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden page-transition" key={section + (id || '')}>
          {/* Top Header */}
          <div className="flex justify-between items-center mb-8 bg-card px-4 md:px-6 py-4 rounded-2xl shadow-soft border">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-secondary/50 transition md:hidden shrink-0"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <div>
                <h2 className="font-display font-extrabold text-xl md:text-2xl capitalize">
                  {section === 'product-new' || section === 'csv'
                    ? 'Add Product'
                    : ['faqs', 'chat-logs', 'customers', 'product-qa', 'clients', 'settings'].includes(section)
                    ? 'Settings'
                    : section.replace('-', ' ')}
                </h2>
                <p className="text-[10px] md:text-xs text-muted-foreground">Welcome back, Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                Live
              </div>
              <AdminHeaderNotifications />
            </div>
          </div>

          {/* Sections Render Switch wrapped in ErrorBoundary */}
          <AdminErrorBoundary>
            {section === 'dashboard' && <AdminDashboard refreshTrigger={refreshTrigger}/>}
            {section === 'customer-pricing' && <CustomerPricingManager />}
            {section === 'products' && <AdminProducts router={router}/>}
            {(section === 'product-new' || section === 'csv') && (
              <AdminAddProductSection router={router} defaultTab={section === 'csv' ? 'csv' : 'single'} />
            )}
            {section === 'product-edit' && <AdminProductForm router={router} editId={id}/>}
            {section === 'orders' && (id ? <AdminOrderDetail orderId={id}/> : <AdminOrders refreshTrigger={refreshTrigger} router={router}/>)}
            {section === 'inventory' && <InventoryManager />}
            {section === 'vendors' && <VendorManager />}
            {section === 'billing' && <BillingManager />}
            {section === 'reports' && <AdminReports/>}
            {['settings', 'faqs', 'chat-logs', 'customers', 'product-qa', 'clients', 'banners'].includes(section) && (
              <AdminSettingsSection
                setSettings={setSettings}
                defaultTab={['faqs', 'chat-logs', 'customers', 'product-qa', 'clients', 'banners'].includes(section) ? section : 'site'}
              />
            )}
            {/* Centered New Order Notification Popup */}
            {activeOrderPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in zoom-in duration-200 pointer-events-auto">
                <div className="bg-card text-foreground border border-border/80 rounded-3xl p-6 shadow-2xl max-w-md w-full relative overflow-hidden text-left">
                  {/* Animated 5s Countdown Progress Bar */}
                  <div 
                    className="absolute top-0 left-0 h-1.5 gold-gradient transition-all duration-1000 ease-linear"
                    style={{ width: `${(popupCountdown / 5) * 100}%` }}
                  />

                  <button 
                    onClick={() => setActiveOrderPopup(null)} 
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center font-bold text-primary shrink-0 shadow-glow">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px] uppercase font-extrabold px-2 py-0.5">
                        🎉 New Order Received!
                      </Badge>
                      <h3 className="font-display font-extrabold text-xl text-foreground">
                        Order #{activeOrderPopup.order_number}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-secondary/40 p-4 rounded-2xl border mb-5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="font-bold text-foreground">{activeOrderPopup.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Total:</span>
                      <span className="font-extrabold text-accent text-sm">₹{Number(activeOrderPopup.total || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Placed At:</span>
                      <span className="font-medium text-foreground">{new Date(activeOrderPopup.placed_at).toLocaleTimeString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={() => {
                        router.push(`/admin/orders/${activeOrderPopup.id}`)
                        setActiveOrderPopup(null)
                      }} 
                      className="flex-1 rounded-xl gold-gradient text-primary font-extrabold text-xs h-10 shadow-glow"
                    >
                      View Order Details
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveOrderPopup(null)} 
                      className="rounded-xl text-xs h-10 px-4"
                    >
                      Dismiss ({popupCountdown}s)
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Realtime Floating Toast Notification */}
            <AdminToastFeed activePopup={activeOrderPopup} onDismiss={() => setActiveOrderPopup(null)} />
          </AdminErrorBoundary>
        </main>
      </div>
    </div>
  )
}

function AdminAddProductSection({ router, defaultTab = 'single' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 slide-up text-left">
      {/* Header and Tab Toggle */}
      <div className="bg-card p-6 radius-lg shadow-soft border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Add Product & Catalog Import</h1>
          <p className="text-xs text-muted-foreground mt-1">Add individual products manually or import bulk items using a CSV file.</p>
        </div>

        <div className="flex bg-secondary p-1 rounded-2xl border shrink-0">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'single'
                ? 'gold-gradient text-primary shadow-soft'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="w-4 h-4" /> Add Single Product
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'csv'
                ? 'gold-gradient text-primary shadow-soft'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-4 h-4" /> Bulk Import via CSV
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'single' ? (
        <AdminProductForm router={router} />
      ) : (
        <AdminCSV />
      )}
    </div>
  )
}

function AdminSettingsSection({ setSettings, defaultTab = 'site' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  const settingsTabs = [
    { id: 'site', label: 'Site Settings', icon: Settings },
    { id: 'banners', label: 'Hero Banners', icon: ImageIcon },
    { id: 'faqs', label: 'FAQ Manager', icon: FileText },
    { id: 'chat-logs', label: 'Chat Logs', icon: MessageSquare },
    { id: 'customers', label: 'VIP / Customers', icon: Users },
    { id: 'product-qa', label: 'Product Q&A', icon: MessageSquare },
    { id: 'clients', label: 'Client Logos', icon: Building2 },
  ]

  return (
    <div className="space-y-6 slide-up text-left">
      {/* Settings Sub-Navigation Header Tabs */}
      <div className="bg-card px-6 pt-6 rounded-2xl shadow-soft border">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-extrabold text-foreground">Settings & Configurations</h1>
          <p className="text-xs text-muted-foreground mt-1">Manage global website settings, homepage hero banners, FAQs, support logs, customer profiles, Q&A, and partner logos.</p>
        </div>
        <div className="flex border-b border-border/60 overflow-x-auto space-x-1 sm:space-x-2 scrollbar-none">
          {settingsTabs.map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 flex items-center gap-2 ${
                  isActive
                    ? 'border-primary text-primary font-extrabold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Settings Active Tab Component */}
      <div>
        {activeTab === 'site' && <AdminSettings setSettings={setSettings} />}
        {activeTab === 'banners' && <AdminBanners />}
        {activeTab === 'faqs' && <AdminFAQs />}
        {activeTab === 'chat-logs' && <AdminChatLogs />}
        {activeTab === 'customers' && <AdminCustomers />}
        {activeTab === 'product-qa' && <AdminQA />}
        {activeTab === 'clients' && <AdminClients />}
      </div>
    </div>
  )
}

function AdminDashboard({ refreshTrigger }) {
  const [s, setS] = useState(null)
  
  let liveCustomersState = { onlineCount: 1, onlineUsers: [] }
  try {
    const res = useLiveCustomers()
    if (res) liveCustomersState = res
  } catch (e) {}

  const onlineCount = liveCustomersState?.onlineCount || 1

  const fetchStats = useCallback(() => {
    fetch('/api/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data === 'object' && !data.error) {
          setS(data)
        } else {
          setS(null)
        }
      })
      .catch(() => setS(null))
  }, [])

  useRealtimeDashboard(fetchStats)

  useEffect(() => { 
    fetchStats()
  }, [refreshTrigger])

  if (!s || typeof s !== 'object') return <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">{Array(5).fill(0).map((_,i) => <div key={i} className="h-24 skeleton"/>)}</div>

  const safeOnlineCount = Number(onlineCount || 1)
  const safeOrders = Number(s.orders || 0)
  const safeRevenue = Number(s.revenue || 0)
  const safePending = Number(s.pending || 0)
  const byDayData = (s.byDay && typeof s.byDay === 'object') ? s.byDay : {}
  const lowStockData = Array.isArray(s.lowStock) ? s.lowStock : []

  const cards = [
    ['Online Customers', safeOnlineCount, Users, 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'],
    ['Active Sessions', Math.max(1, safeOnlineCount), Activity, 'text-blue-600 bg-blue-500/10 border-blue-500/20'],
    ['Orders Today', safeOrders, Package, 'text-purple-600 bg-purple-500/10 border-purple-500/20'],
    ['Revenue Today', formatINR(safeRevenue), TrendingUp, 'text-amber-600 bg-amber-500/10 border-amber-500/20'],
    ['Pending Orders', safePending, ClipboardList, 'text-red-600 bg-red-500/10 border-red-500/20']
  ]

  const dayValues = Object.values(byDayData).map(v => Number(v || 0))
  const max = Math.max(1, ...dayValues)

  return (
    <div className="slide-up text-left space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Live Operations Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-1">Real-time status of online customers, active sessions, sales revenue, and incoming orders.</p>
      </div>

      {/* 5 Real-Time Metric Cards */}
      <GlobalErrorBoundary compact fallbackTitle="Metric Cards Unavailable">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map(([l, v, Icon, badgeStyle]) => (
            <Card key={l} className="radius-lg shadow-soft card-lift overflow-hidden relative border border-border/80">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl border ${badgeStyle}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {l === 'Online Customers' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <p className="font-display text-2xl md:text-3xl font-extrabold text-foreground">{v}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">{l}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </GlobalErrorBoundary>

      {/* Real-time Order Trend & Low Stock Alerts */}
      <div className="grid md:grid-cols-2 gap-6">
        <GlobalErrorBoundary compact fallbackTitle="Order Volume Chart">
          <Card className="radius-lg shadow-soft border border-border/80">
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-base mb-4 text-foreground">Order Volume — Last 7 Days</h3>
              <div className="flex items-end gap-2 h-40">
                {Object.entries(byDayData).map(([k, v]) => (
                  <div key={k} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full gold-gradient rounded-t-lg transition-all shadow-soft" 
                      style={{ height: `${(v / max) * 100}%`, minHeight: '4px' }}
                    />
                    <span className="text-[10px] text-muted-foreground font-semibold">{k.slice(5)}</span>
                    <span className="text-xs font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </GlobalErrorBoundary>

        <GlobalErrorBoundary compact fallbackTitle="Stock Alerts">
          <Card className="radius-lg shadow-soft border border-border/80">
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-base mb-4 flex items-center gap-2 text-foreground">
                <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
                Low Stock Alert
              </h3>
              {lowStockData.length === 0 ? (
                <p className="text-xs text-muted-foreground">All inventory items are well-stocked.</p>
              ) : (
                <div className="space-y-2">
                  {lowStockData.map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 rounded-xl bg-secondary/50">
                      <span className="font-semibold text-foreground line-clamp-1">{p.name}</span>
                      <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'secondary'}>
                        {p.stock_quantity} left
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </GlobalErrorBoundary>
      </div>

      {/* Real-time Activity Feed Stream (Component Error Isolated) */}
      <GlobalErrorBoundary compact fallbackTitle="Live Activity Feed">
        <AdminLiveActivityFeed />
      </GlobalErrorBoundary>
    </div>
  )
}

function AdminProducts({ router }) {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const load = () => {
    fetch('/api/products', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setList(data)
        else if (data && Array.isArray(data.products)) setList(data.products)
        else setList([])
      })
      .catch(() => setList([]))
  }
  useEffect(() => { load() }, [])

  const del = async id => { 
    if (!confirm('Delete product?')) return; 
    try { 
      await fetch('/api/products/' + id, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      toast.success('Deleted')
      load() 
    } catch (e) { toast.error(e.message) } 
  }

  const toggle = async p => { 
    try { 
      await fetch('/api/products/' + p.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ is_active: !p.is_active }) })
      load() 
    } catch {} 
  }

  const filtered = (Array.isArray(list) ? list : []).filter(p => !q || (p?.name || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="slide-up text-left">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Products <span className="text-muted-foreground text-sm font-semibold ml-1">({list?.length || 0} total)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Manage catalog items, pricing, inventory stock, and visibility status.</p>
        </div>
        <div className="flex gap-2.5">
          <QuickAddCategory 
            onCategoryAdded={() => toast.success('Category added!')}
            trigger={
              <Button type="button" className="rounded-xl bg-secondary hover:bg-secondary/80 border border-border/80 text-foreground font-bold text-xs shadow-soft h-10 px-4 flex items-center">
                <Plus className="w-4 h-4 mr-1.5"/> Add Category
              </Button>
            }
          />
          <Button onClick={() => router.push('/admin/product-new')} className="rounded-xl gold-gradient text-primary font-bold text-xs shadow-soft h-10 px-4 flex items-center">
            <Plus className="w-4 h-4 mr-1.5"/> Add Product
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Input placeholder="Search products by name..." value={q} onChange={e => setQ(e.target.value)} className="max-w-sm h-10 rounded-xl text-xs bg-card"/>
      </div>

      <Card className="radius-lg shadow-soft overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[800px]">
            <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
              <tr>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">Price</th>
                <th className="p-3.5">Stock</th>
                <th className="p-3.5">Media</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!list ? (
                <tr><td colSpan="6" className="p-12 text-center text-muted-foreground">Loading products...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-muted-foreground">No products found.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images?.[0] || p.image_url || '/placeholder-product.png'}
                          onError={(e) => { e.currentTarget.src = '/placeholder-product.png' }}
                          className="w-10 h-12 object-cover rounded-lg shrink-0 border bg-secondary/20 shadow-sm"
                          alt=""
                        />
                        <div>
                          <p className="font-semibold text-foreground leading-snug line-clamp-1 max-w-xs">{p.name || 'Untitled Product'}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono">{p.sku || 'NO-SKU'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-extrabold text-sm">{formatINR(p.price)}</td>
                    <td className="p-3.5">
                      <Badge variant={p.stock_quantity < 10 ? 'destructive' : 'secondary'} className="font-mono font-bold text-[10px]">
                        {p.stock_quantity ?? 0}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <div className="flex gap-2 items-center text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5"/>{p.images?.length || 0}</span>
                        {p.videos?.length > 0 && <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5 text-blue-600"/>{p.videos.length}</span>}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <button onClick={() => toggle(p)}>
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className="rounded-full text-[10px] font-bold uppercase">
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => router.push('/admin/product-edit/' + p.id)} className="rounded-xl text-xs h-8">
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => del(p.id)} className="rounded-xl text-xs h-8 hover:bg-destructive/10 text-destructive">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function FileUploader({ accept, onUploaded, label, multiple, kind }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)
  const upload = async (files) => {
    setUploading(true); setProgress(0)
    const results = []
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData(); fd.append('file', files[i])
      try { 
        const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        if (!res.ok) throw new Error('Upload failed')
        const r = await res.json()
        results.push(r)
        setProgress(Math.round(((i + 1) / files.length) * 100)) 
      } catch (e) { toast.error(`Upload failed: ${files[i].name}`) }
    }
    setUploading(false)
    if (results.length) { toast.success(`Uploaded ${results.length} file(s)`); onUploaded(results.map(r => r.url)) }
  }
  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={e => { const files = Array.from(e.target.files || []); if (files.length) upload(files); e.target.value = '' }}/>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-border rounded-xl p-6 hover:border-accent hover:bg-accent/5 transition text-center group">
        {uploading ? <div><div className="w-12 h-12 mx-auto mb-2 relative"><svg className="w-full h-full spin-slow" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted opacity-30"/><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" fill="none" className="text-accent" strokeDasharray={`${progress * 2.5} 250`}/></svg></div><p className="font-medium">Uploading... {progress}%</p></div> :
        <div>{kind === 'video' ? <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-accent transition"/> : <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-accent transition"/>}<p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground mt-1">Click to select from your device</p></div>}
      </button>
    </div>
  )
}

function AdminProductForm({ router, editId }) {
  const [f, setF] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    category_id: '',
    subcategory: '',
    stock_quantity: '',
    sku: '',
    hsn_code: '',
    gst_percent: '18',
    is_featured: false,
    is_active: true,
    images: [],
    videos: [],
    brand: '',
    unit: '',
    weight: '',
    tags: '',
    thumbnail: '',
    gallery_images: []
  })
  const [cats, setCats] = useState([])
  
  useEffect(() => { 
    fetch('/api/categories').then(r => r.json()).then(setCats) 
  }, [])

  useEffect(() => { 
    if (editId) {
      fetch('/api/products/' + editId, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(r => r.json())
      .then(p => {
        setF({
          name: p.name || '',
          description: p.description || '',
          price: p.price !== undefined ? String(p.price) : '',
          mrp: p.mrp !== undefined ? String(p.mrp) : '',
          category_id: p.category_id || '',
          subcategory: p.subcategory || '',
          stock_quantity: p.stock_quantity !== undefined ? String(p.stock_quantity) : '',
          sku: p.sku || '',
          hsn_code: p.hsn_code || '',
          gst_percent: p.gst_percent !== undefined ? String(p.gst_percent) : '18',
          is_featured: !!p.is_featured,
          is_active: p.is_active !== false,
          images: p.images || [],
          videos: p.videos || [],
          brand: p.brand || '',
          unit: p.unit || '',
          weight: p.weight || '',
          tags: p.tags || '',
          thumbnail: p.thumbnail || '',
          gallery_images: p.gallery_images || []
        })
      })
      .catch(e => {
        console.error('[Fetch Product Error]:', e)
        toast.error('Failed to load product details')
      })
    }
  }, [editId])

  const save = async e => {
    e.preventDefault()
    const body = { 
      ...f, 
      price: +f.price, 
      mrp: f.mrp ? +f.mrp : null, 
      stock_quantity: +f.stock_quantity, 
      gst_percent: +f.gst_percent 
    }
    try { 
      let res
      if (editId) res = await fetch('/api/products/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(body) })
      else res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Save failed')
      toast.success(editId ? 'Updated' : 'Created')
      router.push('/admin/products') 
    } catch (e) { toast.error(e.message) }
  }

  const removeImg = i => setF({ ...f, images: f.images.filter((_, idx) => idx !== i) })
  const removeVid = i => setF({ ...f, videos: f.videos.filter((_, idx) => idx !== i) })

  return (
    <div className="w-full max-w-5xl mx-auto slide-up text-left">
      <h1 className="font-display text-3xl font-extrabold mb-6 text-foreground">{editId ? 'Edit Product' : 'Add Product'}</h1>
      <form onSubmit={save} className="space-y-6">
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold flex items-center gap-2 text-lg"><FileText className="w-5 h-5"/>Basic Info</h3>
          <div><Label>Product Name *</Label><Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="h-11 rounded-xl"/></div>
          <div><Label>Description</Label><Textarea rows={4} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className="rounded-xl"/></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label className="mb-0">Category *</Label>
                <QuickAddCategory cats={cats} onCategoryAdded={newCat => {
                  setCats([...cats, newCat])
                  setF(prev => ({ ...prev, category_id: newCat.id }))
                }} />
              </div>
              <Select value={f.category_id} onValueChange={v => setF({ ...f, category_id: v })}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Sub-category</Label><Input value={f.subcategory} onChange={e => setF({ ...f, subcategory: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Price (₹) *</Label><Input required type="number" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>MRP (₹)</Label><Input type="number" value={f.mrp} onChange={e => setF({ ...f, mrp: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Stock *</Label><Input required type="number" value={f.stock_quantity} onChange={e => setF({ ...f, stock_quantity: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>SKU</Label><Input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>HSN Code *</Label><Input required value={f.hsn_code} onChange={e => setF({ ...f, hsn_code: e.target.value })} placeholder="e.g. 4820" className="h-11 rounded-xl"/></div>
            <div><Label>GST Rate (%)</Label><Select value={String(f.gst_percent)} onValueChange={v => setF({ ...f, gst_percent: v })}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select GST %"/></SelectTrigger><SelectContent><SelectItem value="0">0% — Exempt</SelectItem><SelectItem value="5">5% GST</SelectItem><SelectItem value="12">12% GST</SelectItem><SelectItem value="18">18% GST</SelectItem><SelectItem value="28">28% GST</SelectItem></SelectContent></Select></div>
            
            {/* Added Extra Metadata Fields */}
            <div><Label>Brand</Label><Input value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} placeholder="e.g. AK Premium, Camlin" className="h-11 rounded-xl"/></div>
            <div><Label>Unit</Label><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="e.g. Box, Kg, Pcs" className="h-11 rounded-xl"/></div>
            <div><Label>Weight</Label><Input value={f.weight} onChange={e => setF({ ...f, weight: e.target.value })} placeholder="e.g. 500g, 1.2kg" className="h-11 rounded-xl"/></div>
            <div><Label>Tags</Label><Input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="e.g. stationery, office-supplies (comma separated)" className="h-11 rounded-xl"/></div>
            <div className="sm:col-span-2"><Label>Thumbnail Image URL</Label><Input value={f.thumbnail} onChange={e => setF({ ...f, thumbnail: e.target.value })} placeholder="Optional: direct image URL for listing preview" className="h-11 rounded-xl"/></div>
          </div>
          <div className="flex gap-4 pt-2"><label className="flex items-center gap-2 cursor-pointer font-semibold"><input type="checkbox" checked={f.is_featured} onChange={e => setF({ ...f, is_featured: e.target.checked })}/>Featured Product</label><label className="flex items-center gap-2 cursor-pointer font-semibold"><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })}/>Active / Visible Status</label></div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold flex items-center gap-2 text-lg"><ImageIcon className="w-5 h-5"/>Product Images</h3>
          <FileUploader accept="image/*" multiple label="Click to upload new images" onUploaded={urls => setF(prev => ({ ...prev, images: [...prev.images, ...urls] }))}/>
          
          {f.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
              {f.images.map((url, i) => (
                <div key={i} className="relative rounded-xl border p-2 bg-secondary/30 space-y-2 flex flex-col justify-between scale-in">
                  <div className="relative aspect-square rounded-lg overflow-hidden border bg-background">
                    <Image src={url} alt="" fill className="object-cover" />
                  </div>
                  <div className="flex gap-1.5 mt-auto">
                    <label className="flex-1">
                      <span className="w-full text-center block text-[11px] font-bold py-1.5 px-2 bg-background border hover:bg-secondary rounded-lg cursor-pointer">
                        Replace
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const fd = new FormData()
                          fd.append('file', file)
                          try {
                            const res = await fetch('/api/upload', {
                              method: 'POST',
                              body: fd,
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            })
                            if (!res.ok) throw new Error('Upload failed')
                            const data = await res.json()
                            const newImages = [...f.images]
                            newImages[i] = data.url
                            setF({ ...f, images: newImages })
                            toast.success('Image replaced successfully')
                          } catch (err) {
                            toast.error(err.message)
                          }
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeImg(i)}
                      className="h-8 px-2 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-lg text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold flex items-center gap-2 text-lg"><Video className="w-5 h-5"/>Product Videos</h3>
          <FileUploader accept="video/*" multiple kind="video" label="Click to upload videos" onUploaded={urls => setF(prev => ({ ...prev, videos: [...prev.videos, ...urls] }))}/>
          {f.videos.length > 0 && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{f.videos.map((url, i) => (
            <div key={i} className="relative group aspect-video rounded-xl overflow-hidden border bg-black scale-in"><video src={url} controls className="w-full h-full object-cover"/><button type="button" onClick={() => removeVid(i)} className="absolute top-2 right-2 w-8 h-8 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4 text-white"/></button></div>
          ))}</div>}
        </CardContent></Card>

        <div className="flex gap-2 sticky bottom-4 glass-strong border radius-lg p-3 shadow-elevated"><Button type="submit" size="lg" className="rounded-full btn-shine flex-1">Save Product</Button><Button type="button" size="lg" variant="outline" onClick={() => router.push('/admin/products')} className="rounded-full">Cancel</Button></div>
      </form>
    </div>
  )
}

function AdminCSV() {
  const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false)
  const parse = e => { 
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { 
      const lines = reader.result.split(/\r?\n/).filter(Boolean); const headers = lines[0].split(',').map(h => h.trim())
      const parsed = lines.slice(1).map(l => { const vals = l.split(',').map(v => v.trim()); return Object.fromEntries(headers.map((h, i) => [h, vals[i]])) })
      setRows(parsed) 
    }
    reader.readAsText(file) 
  }
  const importRows = async () => { 
    setBusy(true); 
    try { 
      const res = await fetch('/api/products-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ rows }) })
      if (!res.ok) throw new Error('Import failed')
      const { inserted } = await res.json()
      toast.success(`Imported ${inserted} products`); 
      setRows([]) 
    } catch (e) { toast.error(e.message) } finally { setBusy(false) } 
  }
  return (
    <div className="slide-up">
      <h1 className="font-display text-4xl font-extrabold mb-6">CSV Bulk Import</h1>
      <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
        <div className="bg-secondary/50 p-4 rounded-xl text-sm"><p className="font-bold mb-1">CSV columns:</p><code className="text-xs">name, description, price, mrp, category_slug, subcategory, stock_quantity, sku, is_featured, images (pipe-separated)</code></div>
        <Input type="file" accept=".csv" onChange={parse}/>
        {rows.length > 0 && <>
          <p className="font-semibold">Preview ({rows.length} rows)</p>
          <div className="max-h-60 overflow-auto border rounded-xl"><table className="w-full text-xs"><thead className="bg-secondary sticky top-0"><tr>{Object.keys(rows[0]).map(k => <th key={k} className="p-2 text-left">{k}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((r, i) => <tr key={i} className="border-t">{Object.values(r).map((v, j) => <td key={j} className="p-2">{String(v).slice(0, 40)}</td>)}</tr>)}</tbody></table></div>
          <Button onClick={importRows} disabled={busy} className="rounded-full btn-shine">{busy ? 'Importing...' : `Import ${rows.length} products`}</Button>
        </>}
      </CardContent></Card>
    </div>
  )
}

function AdminOrders({ refreshTrigger, router }) {
  const [orders, setOrders] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // Filtering & Pagination State
  const [range, setRange] = useState('last-12-months')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  
  // Custom Date Range
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)

  // Selected for quick status update dialog
  const [selected, setSelected] = useState(null)
  const [highlightOrderId, setHighlightOrderId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('range', range)
      q.set('status', status)
      q.set('search', search)
      q.set('page', String(page))
      q.set('limit', String(limit))
      
      if (range === 'custom') {
        if (customStartDate) q.set('startDate', customStartDate)
        if (customEndDate) q.set('endDate', customEndDate)
      }

      const res = await fetch('/api/orders?' + q.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
      } else {
        toast.error('Failed to load orders')
      }
    } catch (e) {
      toast.error('Network error loading orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [range, status, page, limit, refreshTrigger])

  // Reload when search finishes typing (debounced or triggered manually)
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  // Prepend live newly placed orders from useRealtimeOrders hook
  useRealtimeOrders(useCallback(() => {
    // Rely on Supabase realtime triggers to pull updates
    const token = localStorage.getItem('token')
    const q = new URLSearchParams({ page: '1', limit: '50', range, status, search })
    fetch('/api/orders?' + q.toString(), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.orders) {
          // Identify if there's a new order added
          const oldIds = new Set(orders.map(o => o.id))
          const newlyAdded = data.orders.find(o => !oldIds.has(o.id))
          
          setOrders(data.orders)
          setTotalCount(data.totalCount || 0)
          setTotalPages(data.totalPages || 1)

          if (newlyAdded) {
            setHighlightOrderId(newlyAdded.id)
            setTimeout(() => {
              setHighlightOrderId(null)
            }, 5000)
          }
        }
      })
      .catch(console.error)
  }, [orders, range, status, search]))

  const updateStatus = async (id, newStatus) => { 
    try { 
      const res = await fetch('/api/orders/' + id, { 
        method: 'PUT', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }, 
        body: JSON.stringify({ status: newStatus }) 
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Order status updated to ${newStatus.toUpperCase()}`)
        load()
        setSelected(null)
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch (e) { toast.error(e.message) } 
  }

  // Analytics Calculation using the current loaded datasets
  const analytics = useMemo(() => {
    let delivered = 0
    let cancelled = 0
    let totalRevenue = 0
    const vendorCounts = {}
    const customerSpent = {}
    const productCounts = {}
    const categoryRevenue = {}
    
    orders.forEach(o => {
      const grandTotal = Number(o.total || 0)
      if (o.status === 'delivered') {
        delivered++
        totalRevenue += grandTotal
      } else if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'vendor_rejected') {
        cancelled++
      } else {
        totalRevenue += grandTotal
      }

      // Top Vendors
      if (o.vendor_name) {
        vendorCounts[o.vendor_name] = (vendorCounts[o.vendor_name] || 0) + 1
      }

      // Top Customers
      const custName = o.address?.full_name || 'Guest Customer'
      customerSpent[custName] = (customerSpent[custName] || 0) + grandTotal

      // Top Products & Categories
      ;(o.items || []).forEach(it => {
        const pName = it.product_name_snapshot || 'Product'
        const qty = Number(it.quantity || 0)
        const itemVal = qty * Number(it.price_snapshot || 0)
        productCounts[pName] = (productCounts[pName] || 0) + qty

        // Derive sub-market category name
        const cat = it.products?.subcategory || 'General Stationery'
        categoryRevenue[cat] = (categoryRevenue[cat] || 0) + itemVal
      })
    })

    const avgOrderVal = orders.length > 0 ? totalRevenue / orders.length : 0

    const topVendors = Object.entries(vendorCounts).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(e => e[0])
    const topCustomers = Object.entries(customerSpent).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(e => e[0])
    const topProducts = Object.entries(productCounts).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(e => e[0])
    const topCategories = Object.entries(categoryRevenue).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(e => e[0])

    return {
      revenue: totalRevenue,
      delivered,
      cancelled,
      avgOrderVal,
      topVendors,
      topCustomers,
      topProducts,
      topCategories
    }
  }, [orders])

  const exportData = (format) => {
    if (orders.length === 0) {
      toast.error('No orders available to export')
      return
    }

    if (format === 'csv') {
      const headers = ['Order ID', 'Invoice Number', 'Date', 'Customer Name', 'Customer Email', 'Phone', 'Shipping City', 'State', 'Vendor Assigned', 'Payment Method', 'Payment Status', 'Grand Total', 'Status']
      const rows = orders.map(o => [
        o.order_number,
        `INV-${o.order_number}`,
        new Date(o.placed_at).toLocaleDateString('en-IN'),
        o.address?.full_name || 'N/A',
        o.user_email || 'Guest',
        o.address?.phone || '',
        o.address?.city || '',
        o.address?.state || '',
        o.vendor_name || 'Unassigned',
        o.payment_method || 'COD',
        o.payment_status || 'Pending',
        o.total || 0,
        o.status || 'pending'
      ])

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n")
      
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `orders_export_${range}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('CSV export completed successfully!')
    } else {
      toast.info(`${format.toUpperCase()} export is processing. Use CSV for instant spreadsheet files.`)
    }
  }

  const statuses = ['pending', 'confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']
  
  return (
    <div className="slide-up space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Order Records System</h1>
          <p className="text-sm text-muted-foreground">Manage and filter historical sales, delivery timelines, and logistics partner dispatches.</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={() => exportData('csv')} size="sm" className="rounded-xl flex items-center gap-1.5 font-bold">
            Export CSV
          </Button>
          <Button onClick={() => exportData('excel')} size="sm" variant="outline" className="rounded-xl flex items-center gap-1.5 font-bold">
            Export Excel
          </Button>
        </div>
      </div>

      {/* Analytics Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="radius-xl shadow-soft p-4 border relative overflow-hidden bg-primary text-primary-foreground">
          <span className="text-[10px] uppercase font-bold text-primary-foreground/60 tracking-wider">Revenue (Filtered)</span>
          <p className="text-xl font-black mt-1">{formatINR(analytics.revenue)}</p>
        </Card>
        <Card className="radius-xl shadow-soft p-4 border relative overflow-hidden">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Order Value</span>
          <p className="text-xl font-black mt-1 text-foreground">{formatINR(analytics.avgOrderVal)}</p>
        </Card>
        <Card className="radius-xl shadow-soft p-4 border relative overflow-hidden">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Delivered</span>
          <p className="text-xl font-black mt-1 text-emerald-600">{analytics.delivered} orders</p>
        </Card>
        <Card className="radius-xl shadow-soft p-4 border relative overflow-hidden">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cancelled / Rejected</span>
          <p className="text-xl font-black mt-1 text-destructive">{analytics.cancelled} orders</p>
        </Card>
      </div>

      {/* Search & Advanced Filters Bar */}
      <Card className="radius-lg shadow-soft border">
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by Order ID, Customer, Vendor, Product, Phone, Email, Invoice..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl text-sm"
              />
            </div>
            <Button type="submit" className="h-11 rounded-xl px-5 font-bold">Search</Button>
          </form>

          <div className="flex flex-wrap gap-4 items-end text-xs font-semibold">
            
            {/* Time Filter */}
            <div className="w-full sm:w-44">
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Time Period</label>
              <Select 
                value={range} 
                onValueChange={(val) => {
                  setRange(val)
                  setPage(1)
                  setShowCustomDates(val === 'custom')
                }}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                  <SelectItem value="last-90-days">Last 90 Days</SelectItem>
                  <SelectItem value="last-6-months">Last 6 Months</SelectItem>
                  <SelectItem value="last-12-months">Last 12 Months (Default)</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dates Inputs */}
            {showCustomDates && (
              <div className="flex gap-2 items-center">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Start Date</label>
                  <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="h-10 rounded-xl" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">End Date</label>
                  <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="h-10 rounded-xl" />
                </div>
                <Button onClick={() => { setPage(1); load() }} className="h-10 rounded-xl font-bold self-end">Apply Range</Button>
              </div>
            )}

            {/* Status Filter */}
            <div className="w-full sm:w-44">
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Fulfillment Status</label>
              <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1) }}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset */}
            <Button 
              variant="outline" 
              onClick={() => {
                setRange('last-12-months')
                setStatus('all')
                setSearch('')
                setPage(1)
                setCustomStartDate('')
                setCustomEndDate('')
                setShowCustomDates(false)
              }}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table Container */}
      <Card className="radius-lg shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[950px] text-left">
            <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="p-4">Order / Invoice #</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer Details</th>
                <th className="p-4">Logistics Partner</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4">Fulfillment Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-muted-foreground">
                    Syncing historical database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-muted-foreground">
                    No orders registered in the selected range.
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr 
                    key={o.id} 
                    className={`transition-all duration-500 ${
                      highlightOrderId === o.id 
                        ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-amber-500 animate-pulse' 
                        : 'hover:bg-secondary/20'
                    }`}
                  >
                    <td className="p-4">
                      <span className="font-mono font-bold text-foreground block">#{o.order_number}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">INV-{o.order_number}</span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(o.placed_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-foreground block text-sm">{o.address?.full_name || 'Guest User'}</span>
                      <span className="text-xs text-muted-foreground block font-mono">{o.user_email || ''}</span>
                    </td>
                    <td className="p-4 text-xs">
                      {o.vendor_name ? (
                        <span className={`font-semibold block ${o.vendor_name.includes('No vendor assigned') ? 'text-destructive font-bold' : 'text-foreground'}`}>
                          {o.vendor_name}
                        </span>
                      ) : (
                        <span className="font-semibold text-destructive font-bold block">
                          No vendor assigned to this customer — please assign one in Customer Pricing
                        </span>
                      )}
                      {o.assigned_at && (
                        <span className="text-[9px] text-muted-foreground">Assigned: {new Date(o.assigned_at).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <Badge variant="outline" className="font-bold text-[9px] block w-fit mb-0.5">{o.payment_method || 'COD'}</Badge>
                      <span className={`text-[10px] font-extrabold ${o.payment_status === 'Received' ? 'text-emerald-600' : 'text-amber-600'}`}>{o.payment_status || 'Pending'}</span>
                    </td>
                    <td className="p-4 text-right font-mono font-extrabold text-primary">
                      {formatINR(o.total)}
                    </td>
                    <td className="p-4">
                      <Badge className="capitalize rounded-full font-bold px-2.5 py-0.5 text-[10px] w-fit block">
                        {(o.status || '').replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/admin/orders/${o.id}`)} className="rounded-xl h-8 px-3">
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs font-semibold px-2">
          <span className="text-muted-foreground">
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total orders)
          </span>
          <div className="flex gap-2">
            <Button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              variant="outline"
              size="sm"
              className="rounded-xl h-9 px-3"
            >
              Previous
            </Button>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              variant="outline"
              size="sm"
              className="rounded-xl h-9 px-3"
            >
              Next
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}

function AdminBanners() {
  const [list, setList] = useState(null); const [editing, setEditing] = useState(null)
  const load = () => fetch('/api/banners').then(r=>r.json()).then(setList)
  useEffect(() => { load() }, [])
  const empty = { title: '', subtitle: '', image_url: '', cta_text: 'Shop Now', cta_link: '/products', sort_order: 1, is_active: true }
  const save = async e => { 
    e.preventDefault(); 
    try { 
      if (editing.id) await fetch('/api/banners/' + editing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      else await fetch('/api/banners', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      toast.success('Saved'); setEditing(null); load() 
    } catch (e) { toast.error(e.message) } 
  }
  const del = async id => { if (!confirm('Delete banner?')) return; try { await fetch('/api/banners/' + id, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) } }
  return (
    <div className="slide-up">
      <div className="flex justify-between items-center mb-6"><h1 className="font-display text-4xl font-extrabold">Hero Banners</h1><Button onClick={() => setEditing({ ...empty })} className="rounded-full btn-shine"><Plus className="w-4 h-4 mr-1"/>Add Banner</Button></div>
      <p className="text-sm text-muted-foreground mb-4">Manage the hero slideshow shown on the homepage. Changes reflect instantly.</p>
      <div className="grid md:grid-cols-2 gap-4">{!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-48 skeleton"/>) : list.map(b => (
        <Card key={b.id} className="radius-lg shadow-soft overflow-hidden card-lift"><div className="relative aspect-video"><Image src={b.image_url} alt="" fill className="object-cover" loading="lazy" sizes="(max-width: 768px) 100vw, 50vw"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><div className="text-white"><p className="font-display font-extrabold text-xl">{b.title}</p><p className="text-sm text-white/80 line-clamp-1">{b.subtitle}</p></div></div></div><CardContent className="pt-4 flex justify-between items-center"><Badge variant={b.is_active ? 'default' : 'secondary'} className="rounded-full">{b.is_active ? 'Active' : 'Inactive'}</Badge><div className="space-x-1"><Button size="sm" variant="outline" onClick={() => setEditing(b)} className="rounded-full">Edit</Button><Button size="sm" variant="ghost" onClick={() => del(b.id)} className="rounded-full"><Trash2 className="w-4 h-4 text-destructive"/></Button></div></CardContent></Card>
      ))}</div>
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg radius-lg flex flex-col max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 border-b shrink-0">
            <DialogTitle className="font-display">{editing?.id ? 'Edit' : 'Add'} Banner</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[calc(85vh-150px)]">
                <div>
                  <Label>Title *</Label>
                  <Input required value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="h-11 rounded-xl"/>
                </div>
                <div>
                  <Label>Subtitle</Label>
                  <Textarea value={editing.subtitle} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} rows={2} className="rounded-xl"/>
                </div>
                <div>
                  <Label>Image</Label>
                  {editing.image_url && (
                    <Image src={editing.image_url} alt="" width={400} height={225} className="w-full aspect-video object-cover rounded-xl mb-2" loading="lazy"/>
                  )}
                  <FileUploader accept="image/*" label="Upload banner image" onUploaded={urls => setEditing({ ...editing, image_url: urls[0] })}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>CTA Text</Label>
                    <Input value={editing.cta_text} onChange={e => setEditing({ ...editing, cta_text: e.target.value })} className="h-11 rounded-xl"/>
                  </div>
                  <div>
                    <Label>CTA Link</Label>
                    <Input value={editing.cta_link} onChange={e => setEditing({ ...editing, cta_link: e.target.value })} className="h-11 rounded-xl" placeholder="/products"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date (Optional)</Label>
                    <Input type="datetime-local" value={editing.start_date ? editing.start_date.substring(0, 16) : ''} onChange={e => setEditing({ ...editing, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-11 rounded-xl"/>
                  </div>
                  <div>
                    <Label>End Date (Optional)</Label>
                    <Input type="datetime-local" value={editing.end_date ? editing.end_date.substring(0, 16) : ''} onChange={e => setEditing({ ...editing, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-11 rounded-xl"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Sort Order</Label>
                    <Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} className="h-11 rounded-xl"/>
                  </div>
                  <div className="flex flex-col gap-2 justify-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-muted-foreground">
                      <input type="checkbox" checked={editing.show_countdown || false} onChange={e => setEditing({ ...editing, show_countdown: e.target.checked })} className="rounded border-border text-primary focus:ring-primary w-4 h-4"/>
                      Show countdown timer
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-muted-foreground">
                      <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="rounded border-border text-primary focus:ring-primary w-4 h-4"/>
                      Active Slide
                    </label>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-secondary/20 flex gap-2 shrink-0">
                <Button type="submit" className="flex-1 rounded-full">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminClients() {
  const [list, setList] = useState(null); const [editing, setEditing] = useState(null)
  const load = () => fetch('/api/clients').then(r=>r.json()).then(setList)
  useEffect(() => { load() }, [])
  const empty = { name: '', logo_url: '', sort_order: 1, is_active: true }
  const save = async e => { 
    e.preventDefault(); 
    try { 
      if (editing.id) await fetch('/api/clients/' + editing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      else await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      toast.success('Saved'); setEditing(null); load() 
    } catch (e) { toast.error(e.message) } 
  }
  const del = async id => { if (!confirm('Delete client?')) return; try { await fetch('/api/clients/' + id, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) } }
  return (
    <div className="slide-up">
      <div className="flex justify-between items-center mb-6"><h1 className="font-display text-4xl font-extrabold">Clients / Logos</h1><Button onClick={() => setEditing({ ...empty })} className="rounded-full btn-shine"><Plus className="w-4 h-4 mr-1"/>Add Client</Button></div>
      <p className="text-sm text-muted-foreground mb-4">Trusted-by client logos shown on the homepage marquee.</p>
      <div className="grid md:grid-cols-3 gap-4">{!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-24 skeleton"/>) : list.map(c => (
        <Card key={c.id} className="radius-lg shadow-soft card-lift"><CardContent className="pt-6 flex items-center justify-between"><div className="flex items-center gap-3">{c.logo_url ? <Image src={c.logo_url} width={48} height={48} className="w-12 h-12 object-contain" alt="" loading="lazy"/> : <div className="w-12 h-12 gold-gradient rounded-xl flex items-center justify-center"><Building2 className="w-6 h-6 text-primary"/></div>}<div><p className="font-semibold">{c.name}</p><Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs mt-1">{c.is_active ? 'Active' : 'Inactive'}</Badge></div></div><div className="space-x-1"><Button size="sm" variant="outline" onClick={() => setEditing(c)} className="rounded-full">Edit</Button><Button size="sm" variant="ghost" onClick={() => del(c.id)} className="rounded-full"><Trash2 className="w-4 h-4 text-destructive"/></Button></div></CardContent></Card>
      ))}</div>
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md radius-lg flex flex-col max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 border-b shrink-0">
            <DialogTitle className="font-display">{editing?.id ? 'Edit' : 'Add'} Client</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[calc(85vh-150px)]">
                <div>
                  <Label>Client Name *</Label>
                  <Input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="h-11 rounded-xl"/>
                </div>
                <div>
                  <Label>Logo (optional)</Label>
                  {editing.logo_url && (
                    <Image src={editing.logo_url} width={64} height={64} className="h-16 object-contain mb-2" alt="" loading="lazy"/>
                  )}
                  <FileUploader accept="image/*" label="Upload logo" onUploaded={urls => setEditing({ ...editing, logo_url: urls[0] })}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Sort Order</Label>
                    <Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} className="h-11 rounded-xl"/>
                  </div>
                  <label className="flex items-end pb-2 gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })}/>
                    Active
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-secondary/20 flex gap-2 shrink-0">
                <Button type="submit" className="flex-1 rounded-full">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuickAddCategory({ cats, onCategoryAdded, trigger }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [minOrder, setMinOrder] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: name.trim(),
          min_order_value: minOrder !== '' ? Number(minOrder) : null
        })
      })
      if (!res.ok) throw new Error('Failed to create category')
      const newCat = await res.json()
      toast.success('Category created successfully')
      setName('')
      setMinOrder('')
      setOpen(false)
      if (onCategoryAdded) onCategoryAdded(newCat)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, { onClick: () => setOpen(true) })
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add New
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md radius-lg p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Quick Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="e.g. Office Stationery"
              />
            </div>
            <div>
              <Label>Minimum Order Value (₹, optional)</Label>
              <Input
                type="number"
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="e.g. 500 (blank for no minimum)"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving} className="flex-1 rounded-full">
                {saving ? 'Creating...' : 'Create Category'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AdminCategories() {
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null)
  const load = () => fetch('/api/categories').then(r=>r.json()).then(setList)
  useEffect(() => { load() }, [])
  const empty = { name: '', min_order_value: '' }
  
  const save = async e => {
    e.preventDefault();
    try {
      const body = {
        name: editing.name,
        min_order_value: editing.min_order_value !== '' && editing.min_order_value !== null ? +editing.min_order_value : null
      }
      let res
      if (editing.id) {
        res = await fetch('/api/categories/' + editing.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(body)
        })
      } else {
        res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(body)
        })
      }
      if (!res.ok) throw new Error('Failed to save category')
      toast.success('Category saved successfully')
      setEditing(null)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const del = async id => {
    if (!confirm('Are you sure you want to delete this category? All products under this category might lose their connection.')) return
    try {
      const res = await fetch('/api/categories/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Category deleted')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="slide-up text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage product categories and set category-specific Minimum Order Values (MOV) for orders.</p>
        </div>
        <Button onClick={() => setEditing({ ...empty })} className="rounded-full btn-shine shrink-0">
          <Plus className="w-4 h-4 mr-1"/>Add Category
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-24 skeleton"/>) : list.map(c => (
          <Card key={c.id} className="radius-lg shadow-soft card-lift">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-base">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">Slug: {c.slug}</p>
                {c.min_order_value ? (
                  <Badge variant="default" className="text-xs mt-2 bg-emerald-600 hover:bg-emerald-700">
                    Min order: {formatINR(c.min_order_value)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs mt-2 text-muted-foreground">
                    No minimum value
                  </Badge>
                )}
              </div>
              <div className="space-x-1 flex shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)} className="rounded-full">Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="rounded-full">
                  <Trash2 className="w-4 h-4 text-destructive"/>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md radius-lg flex flex-col p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">{editing?.id ? 'Edit' : 'Add'} Category</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4 mt-4">
              <div>
                <Label>Category Name *</Label>
                <Input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="h-11 rounded-xl" placeholder="e.g. Office Stationery"/>
              </div>
              <div>
                <Label>Minimum Order Value (₹, optional)</Label>
                <Input type="number" value={editing.min_order_value || ''} onChange={e => setEditing({ ...editing, min_order_value: e.target.value })} className="h-11 rounded-xl" placeholder="e.g. 500 (blank for no min value)"/>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 rounded-full">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminSettings({ setSettings }) {
  const [f, setF] = useState(null); const [loading, setLoading] = useState(false)
  useEffect(() => { fetch('/api/settings').then(r=>r.json()).then(d => setF({ ...d, marquee_messages: (d.marquee_messages || []).join('\n') })) }, [])
  const save = async e => { 
    e.preventDefault(); setLoading(true)
    try { 
      const body = { ...f, marquee_messages: f.marquee_messages.split('\n').map(s => s.trim()).filter(Boolean) }; 
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(body) }); 
      toast.success('Site settings saved'); 
      setSettings(body) 
    } catch (e) { toast.error(e.message) } finally { setLoading(false) } 
  }
  if (!f) return <div className="space-y-4">{Array(5).fill(0).map((_, i) => <div key={i} className="h-20 skeleton"/>)}</div>
  return (
    <div className="max-w-3xl slide-up">
      <h1 className="font-display text-4xl font-extrabold mb-2">Site Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">All these values render dynamically across the website. No code edits required.</p>
      <form onSubmit={save} className="space-y-6">
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Brand</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Brand Name</Label><Input value={f.brand_name || ''} onChange={e => setF({ ...f, brand_name: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Tagline</Label><Input value={f.brand_tagline || ''} onChange={e => setF({ ...f, brand_tagline: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Hero Badge</Label><Input value={f.hero_badge || ''} onChange={e => setF({ ...f, hero_badge: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Year Established</Label><Input value={f.year_established || ''} onChange={e => setF({ ...f, year_established: e.target.value })} className="h-11 rounded-xl"/></div>
          </div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Promo & CTA</h3>
          <div><Label>Promo Headline</Label><Input value={f.promo_headline || ''} onChange={e => setF({ ...f, promo_headline: e.target.value })} className="h-11 rounded-xl"/></div>
          <div><Label>Promo Sub-line</Label><Textarea value={f.promo_subline || ''} onChange={e => setF({ ...f, promo_subline: e.target.value })} rows={2} className="rounded-xl"/></div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Marquee Ticker</h3>
          <p className="text-xs text-muted-foreground">One message per line — emojis welcome</p>
          <Textarea value={f.marquee_messages || ''} onChange={e => setF({ ...f, marquee_messages: e.target.value })} rows={6} className="rounded-xl font-mono text-sm"/>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Contact Phone</Label><Input value={f.contact_phone || ''} onChange={e => setF({ ...f, contact_phone: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>WhatsApp Number</Label><Input value={f.whatsapp_number || ''} onChange={e => setF({ ...f, whatsapp_number: e.target.value })} className="h-11 rounded-xl" placeholder="918308860894"/></div>
            <div className="col-span-2"><Label>Email</Label><Input value={f.contact_email || ''} onChange={e => setF({ ...f, contact_email: e.target.value })} className="h-11 rounded-xl"/></div>
            <div className="col-span-2"><Label>Address</Label><Textarea value={f.contact_address || ''} onChange={e => setF({ ...f, contact_address: e.target.value })} rows={2} className="rounded-xl"/></div>
            <div className="col-span-2"><Label>Contact Person</Label><Input value={f.contact_person || ''} onChange={e => setF({ ...f, contact_person: e.target.value })} className="h-11 rounded-xl"/></div>
          </div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Legal Policies</h3>
          <div><Label>Privacy Policy</Label><Textarea value={f.policy_privacy || ''} onChange={e => setF({ ...f, policy_privacy: e.target.value })} rows={4} className="rounded-xl"/></div>
          <div><Label>Terms & Conditions</Label><Textarea value={f.policy_terms || ''} onChange={e => setF({ ...f, policy_terms: e.target.value })} rows={4} className="rounded-xl"/></div>
          <div><Label>Refund & Return Policy</Label><Textarea value={f.policy_refund || ''} onChange={e => setF({ ...f, policy_refund: e.target.value })} rows={4} className="rounded-xl"/></div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">GST & Tax Settings</h3>
          <p className="text-xs text-muted-foreground">These settings control how CGST/SGST vs IGST is calculated for customer invoices. Set to your business's registered state.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Supplier / Business State (GSTIN State)</Label>
              <Select value={f.supplier_state || 'Maharashtra'} onValueChange={v => setF({ ...f, supplier_state: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select State"/></SelectTrigger>
                <SelectContent className="max-h-72">
                  {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Customers in <strong>{f.supplier_state || 'Maharashtra'}</strong> will be charged CGST + SGST; all others will be charged IGST.</p>
            </div>
          </div>
        </CardContent></Card>

        <div className="sticky bottom-4 glass-strong border radius-lg p-3 shadow-elevated"><Button type="submit" size="lg" disabled={loading} className="w-full rounded-full btn-shine">{loading ? <><span className="btn-spinner mr-2"/>Saving...</> : 'Save All Settings'}</Button></div>
      </form>
    </div>
  )
}

function AdminFAQs() {
  const [list, setList] = useState(null); const [editing, setEditing] = useState(null)
  const load = () => fetch('/api/admin/faqs', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r=>r.json()).then(setList)
  useEffect(() => { load() }, [])
  const empty = { question: '', answer: '', sort_order: 1 }
  const save = async e => { 
    e.preventDefault(); 
    try { 
      if (editing.id) await fetch('/api/admin/faqs/' + editing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      else await fetch('/api/admin/faqs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(editing) }); 
      toast.success('Saved'); setEditing(null); load() 
    } catch (e) { toast.error(e.message) } 
  }
  const del = async id => { if (!confirm('Delete FAQ?')) return; try { await fetch('/api/admin/faqs/' + id, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) } }
  
  return (
    <div className="slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-4xl font-extrabold">FAQ Manager</h1>
        <Button onClick={() => setEditing({ ...empty })} className="rounded-full btn-shine"><Plus className="w-4 h-4 mr-1"/>Add FAQ</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Manage customer support quick-reply and rule-based queries. Changes reflect instantly.</p>
      <div className="space-y-4">
        {!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-20 skeleton"/>) : list.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No FAQs configured yet.</p> : list.map(f => (
          <Card key={f.id} className="radius-lg shadow-soft overflow-hidden">
            <CardContent className="pt-6 flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">Sort: {f.sort_order}</Badge>
                  <p className="font-display font-bold text-lg text-foreground">{f.question}</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.answer}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditing(f)} className="rounded-full">Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => del(f.id)} className="rounded-full"><Trash2 className="w-4 h-4 text-destructive"/></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg radius-lg flex flex-col max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 border-b shrink-0">
            <DialogTitle className="font-display">{editing?.id ? 'Edit' : 'Add'} FAQ</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[calc(85vh-150px)]">
                <div>
                  <Label>Question *</Label>
                  <Input required value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} className="h-11 rounded-xl"/>
                </div>
                <div>
                  <Label>Answer *</Label>
                  <Textarea required value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })} rows={4} className="rounded-xl"/>
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} className="h-11 rounded-xl"/>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-secondary/20 flex gap-2 shrink-0">
                <Button type="submit" className="flex-1 rounded-full">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminChatLogs() {
  const [list, setList] = useState(null); const [selected, setSelected] = useState(null)
  const load = () => fetch('/api/admin/chat-logs', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r=>r.json()).then(setList)
  useEffect(() => { load() }, [])
  const del = async id => { if (!confirm('Delete this chat log?')) return; try { await fetch('/api/admin/chat-logs/' + id, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); toast.success('Deleted'); if (selected?.id === id) setSelected(null); load() } catch (e) { toast.error(e.message) } }
  
  return (
    <div className="slide-up">
      <h1 className="font-display text-4xl font-extrabold mb-2">Customer Chat Logs</h1>
      <p className="text-sm text-muted-foreground mb-6">Review customer interactions with the support assistant to improve FAQs and responses.</p>
      
      <div className="grid md:grid-cols-3 gap-6">
        {/* Logs List */}
        <div className="md:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-20 skeleton"/>) : list.length === 0 ? <p className="text-sm text-muted-foreground py-4">No chat logs recorded yet.</p> : list.map(log => {
            const lastMsg = log.messages[log.messages.length - 1]
            return (
              <button
                key={log.id}
                onClick={() => setSelected(log)}
                className={`w-full text-left p-4 rounded-xl border transition flex flex-col gap-1 shadow-soft ${selected?.id === log.id ? 'border-primary bg-primary/5' : 'bg-card hover:bg-secondary/30'}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-mono text-xs font-bold text-muted-foreground max-w-[120px] truncate">{log.session_id}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(log.updated_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-foreground font-semibold truncate w-full">{lastMsg?.text || 'Empty conversation'}</p>
                <span className="text-[10px] text-muted-foreground">{log.messages.length} messages</span>
              </button>
            )
          })}
        </div>
        
        {/* Selected Chat Detail */}
        <div className="md:col-span-2">
          {selected ? (
            <Card className="radius-lg shadow-soft h-[70vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-secondary/30 flex justify-between items-center shrink-0">
                <div>
                  <h4 className="font-bold text-sm font-mono truncate max-w-[200px]">{selected.session_id}</h4>
                  <p className="text-[10px] text-muted-foreground">Active: {new Date(selected.updated_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del(selected.id)} className="rounded-full text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4 mr-1"/>Delete Log</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/10">
                {selected.messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[80%] ${m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                    <div className={`p-3 rounded-2xl text-xs ${m.sender === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border rounded-tl-none'}`}>
                      {m.text}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <div className="h-[70vh] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-card shadow-soft">
              <MessageSquare className="w-12 h-12 mb-3 text-muted-foreground/40"/>
              <p className="font-semibold text-sm">Select a conversation log to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminReports() {
  const [dates, setDates] = useState({ start: '', end: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthlyTrends, setMonthlyTrends] = useState([])
  const [trendsLoading, setTrendsLoading] = useState(true)

  const fetchMonthlyTrends = async () => {
    setTrendsLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-trends', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) setMonthlyTrends(await res.json())
    } catch (e) { console.error('Monthly trends error:', e) }
    finally { setTrendsLoading(false) }
  }

  const fetchReports = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (dates.start) q.set('start_date', new Date(dates.start).toISOString())
      if (dates.end) q.set('end_date', new Date(dates.end).toISOString())
      
      const res = await fetch('/api/admin/reports?' + q.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch (e) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
    fetchMonthlyTrends()
  }, [])

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Report Metric', 'Value'],
      ['Total Sales Revenue', `Rs. ${data.totalRevenue}`],
      ['Total Orders Placed', data.ordersCount],
      [],
      ['Category Breakdown', 'Revenue (Rs.)']
    ]
    Object.entries(data.categoryRevenue || {}).forEach(([cat, rev]) => {
      rows.push([cat, rev])
    })
    rows.push([], ['Top Selling Products', 'Quantity'])
    data.topSelling?.forEach(p => {
      rows.push([p.name, p.quantity])
    })

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `sales_report_${dates.start || 'all'}_to_${dates.end || 'all'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const triggerBulkInvoice = () => {
    const q = new URLSearchParams()
    if (dates.start) q.set('start_date', new Date(dates.start).toISOString())
    if (dates.end) q.set('end_date', new Date(dates.end).toISOString())
    window.open(`/api/admin/invoices-export?${q.toString()}&token=${localStorage.getItem('token')}`)
  }

  const salesArray = data ? Object.entries(data.dailySales || {}).sort((a,b) => new Date(a[0]) - new Date(b[0])) : []
  const maxSale = salesArray.length > 0 ? Math.max(...salesArray.map(s => s[1])) : 1

  return (
    <div className="space-y-6 slide-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Sales Reports</h1>
          <p className="text-sm text-muted-foreground">Monitor performance, track orders, and export data for accounting.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} disabled={!data} className="rounded-full"><Plus className="w-4 h-4 mr-1"/>Export CSV</Button>
          <Button onClick={triggerBulkInvoice} disabled={!data} variant="outline" className="rounded-full">Bulk Invoices ZIP</Button>
        </div>
      </div>

      <Card className="radius-lg shadow-soft">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} className="h-10 rounded-xl"/>
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })} className="h-10 rounded-xl"/>
          </div>
          <Button onClick={fetchReports} className="rounded-xl h-10 px-6">Apply Filters</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 skeleton radius-lg"/>
          <div className="h-32 skeleton radius-lg"/>
          <div className="h-32 skeleton radius-lg"/>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="radius-xl shadow-soft bg-primary text-primary-foreground p-6">
              <span className="text-xs uppercase tracking-wider text-primary-foreground/60 font-bold">Total Sales Revenue</span>
              <h2 className="text-3xl font-extrabold mt-2">Rs. {data.totalRevenue.toLocaleString('en-IN')}</h2>
            </Card>
            <Card className="radius-xl shadow-soft p-6 border">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Orders Volume</span>
              <h2 className="text-3xl font-extrabold mt-2 text-foreground">{data.ordersCount} orders</h2>
            </Card>
            <Card className="radius-xl shadow-soft p-6 border">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Categories Served</span>
              <h2 className="text-3xl font-extrabold mt-2 text-foreground">{Object.keys(data.categoryRevenue || {}).length} sub-markets</h2>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="radius-xl shadow-soft border p-6 flex flex-col">
              <h3 className="font-bold text-sm mb-4">Daily Sales Volume</h3>
              {salesArray.length === 0 ? (
                <p className="text-xs text-muted-foreground py-16 text-center">No sales registered in range</p>
              ) : (
                <div className="flex-1 min-h-[200px] flex items-end justify-between gap-2 pt-6">
                  {salesArray.map(([date, val], idx) => {
                    const heightPercent = Math.max(10, Math.round((val / maxSale) * 100))
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div style={{ height: `${heightPercent}%` }} className="w-full bg-primary/20 group-hover:bg-primary rounded-t-sm transition-all duration-300 relative">
                          <span className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-[9px] font-bold px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition whitespace-nowrap">Rs. {val}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground mt-2 rotate-45 origin-left truncate max-w-[40px]">{date.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className="radius-xl shadow-soft border p-6">
              <h3 className="font-bold text-sm mb-4">Revenue by Category</h3>
              <div className="space-y-4">
                {Object.entries(data.categoryRevenue || {}).map(([cat, val], idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>{cat}</span>
                      <span>Rs. {val.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((val / (data.totalRevenue || 1)) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="radius-xl shadow-soft border p-6">
            <h3 className="font-bold text-sm mb-4">Top-Selling Products</h3>
            <div className="divide-y">
              {data.topSelling?.map((p, idx) => (
                <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground w-4">{idx + 1}</span>
                    <span className="font-bold">{p.name}</span>
                  </div>
                  <Badge className="rounded-full px-3">{p.quantity} sold</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* 12-Month Monthly Trends Chart */}
          <Card className="radius-xl shadow-soft border p-6 col-span-full">
            <h3 className="font-bold text-sm mb-1">12-Month Order Trends</h3>
            <p className="text-[11px] text-muted-foreground mb-5">Monthly order volume and revenue — last 12 months</p>
            {trendsLoading ? (
              <div className="h-48 skeleton rounded-xl" />
            ) : monthlyTrends.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">No order data available yet</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Monthly Revenue (₹)</p>
                  <div className="flex items-end gap-1.5 h-36 pt-8 relative">
                    {monthlyTrends.map((m, idx) => {
                      const maxRev = Math.max(...monthlyTrends.map(x => x.revenue), 1)
                      const heightPct = Math.max(4, Math.round((m.revenue / maxRev) * 100))
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative">
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-popover text-popover-foreground px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            ₹{Number(m.revenue).toLocaleString('en-IN')}
                          </span>
                          <div style={{ height: `${heightPct}%` }} className="w-full bg-accent/30 group-hover:bg-accent rounded-t-lg transition-all duration-300" />
                          <span className="text-[8px] text-muted-foreground mt-1 font-medium">{m.month?.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Monthly Order Count</p>
                  <div className="flex items-end gap-1.5 h-24 pt-6 relative">
                    {monthlyTrends.map((m, idx) => {
                      const maxOrds = Math.max(...monthlyTrends.map(x => x.orders), 1)
                      const heightPct = Math.max(4, Math.round((m.orders / maxOrds) * 100))
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative">
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-popover text-popover-foreground px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            {m.orders} orders
                          </span>
                          <div style={{ height: `${heightPct}%` }} className="w-full bg-primary/25 group-hover:bg-primary/60 rounded-t-lg transition-all duration-300" />
                          <span className="text-[8px] text-muted-foreground mt-1">{m.month?.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-secondary"><th className="text-left p-2 font-bold">Month</th><th className="text-right p-2 font-bold">Orders</th><th className="text-right p-2 font-bold">Revenue</th></tr></thead>
                    <tbody>
                      {monthlyTrends.map((m, idx) => (
                        <tr key={idx} className="border-t hover:bg-secondary/30">
                          <td className="p-2 font-mono">{m.month}</td>
                          <td className="p-2 text-right font-semibold">{m.orders}</td>
                          <td className="p-2 text-right font-semibold font-mono">₹{Number(m.revenue).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function AdminCustomers() {
  const [list, setList] = useState(null)
  const [sortField, setSortField] = useState('totalSpent')
  const [filterQuery, setFilterQuery] = useState('')

  const load = () => {
    fetch('/api/admin/customers', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(setList)
      .catch(console.error)
  }

  useEffect(() => {
    load()
  }, [])

  const sortedList = useMemo(() => {
    if (!list) return []
    let result = [...list]
    if (filterQuery) {
      result = result.filter(c => 
        (c.full_name || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(filterQuery.toLowerCase())
      )
    }
    return result.sort((a, b) => {
      if (sortField === 'totalSpent') return b.totalSpent - a.totalSpent
      if (sortField === 'ordersCount') return b.ordersCount - a.ordersCount
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [list, sortField, filterQuery])

  return (
    <div className="space-y-6 slide-up">
      <div>
        <h1 className="font-display text-4xl font-extrabold">VIP Customers</h1>
        <p className="text-sm text-muted-foreground">Monitor buyer loyalty, segment repeat clients, and find your top-spending customers.</p>
      </div>

      <div className="flex gap-4 items-center">
        <Input 
          placeholder="Search customers by name or email..." 
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="max-w-md h-10 rounded-xl"
        />
        <Select value={sortField} onValueChange={setSortField}>
          <SelectTrigger className="w-56 h-10 rounded-xl bg-card">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalSpent">Highest Revenue Spent</SelectItem>
            <SelectItem value="ordersCount">Most Orders Placed</SelectItem>
            <SelectItem value="created_at">Newly Registered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="radius-xl shadow-soft border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Orders Placed</th>
                <th className="p-4">Total Amount Spent</th>
                <th className="p-4">Last Purchase Date</th>
                <th className="p-4">Registration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!list ? Array(3).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-4"><div className="h-6 skeleton rounded"/></td></tr>
              )) : sortedList.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No customer records matching query.</td></tr>
              ) : sortedList.map(c => (
                <tr key={c.id} className="hover:bg-secondary/10 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-foreground">{c.full_name || 'Guest User'}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="p-4 font-mono text-xs">{c.phone || 'N/A'}</td>
                  <td className="p-4 text-center font-bold">
                    <Badge variant={c.ordersCount > 3 ? 'default' : 'outline'} className="rounded-full px-3">{c.ordersCount}</Badge>
                  </td>
                  <td className="p-4 font-extrabold text-primary">Rs. {c.totalSpent.toLocaleString()}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'No Purchases'}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function AdminQA() {
  const [list, setList] = useState(null)
  const [answering, setAnswering] = useState(null)
  const [answerText, setAnswerText] = useState('')

  const load = () => {
    fetch('/api/admin/qa', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(setList)
      .catch(console.error)
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!answerText.trim()) return
    try {
      const res = await fetch(`/api/admin/qa/${answering.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ answer: answerText })
      })
      if (res.ok) {
        toast.success('Answer published successfully')
        setAnswering(null)
        setAnswerText('')
        load()
      } else {
        toast.error('Failed to publish answer')
      }
    } catch {
      toast.error('Network failure')
    }
  }

  return (
    <div className="space-y-6 slide-up">
      <div>
        <h1 className="font-display text-4xl font-extrabold">Product Q&A Manager</h1>
        <p className="text-sm text-muted-foreground">Reply to questions asked by users on product detail pages. Answers display publicly.</p>
      </div>

      <div className="space-y-4">
        {!list ? Array(3).fill(0).map((_, i) => <div key={i} className="h-24 skeleton radius-lg"/>) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No questions asked yet.</p>
        ) : list.map(qa => (
          <Card key={qa.id} className="radius-lg shadow-soft border">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] text-muted-foreground font-mono">User: {qa.user_email}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(qa.created_at).toLocaleDateString()}</span>
              </div>
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">Product: <Link href={`/product/${qa.product_slug}`} className="hover:underline text-primary">{qa.product_name}</Link></div>
                <p className="text-sm font-bold text-foreground">Q: {qa.question}</p>
              </div>

              <div className="p-3 bg-secondary/5 rounded-xl border-l-2 border-primary/20">
                {qa.answer ? (
                  <div>
                    <p className="text-xs text-foreground/80"><span className="font-bold text-primary mr-1">A:</span> {qa.answer}</p>
                    <span className="text-[9px] text-muted-foreground block mt-1">Answered on: {new Date(qa.answered_at).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground italic">Pending seller response</p>
                    <Button size="sm" onClick={() => { setAnswering(qa); setAnswerText('') }} className="rounded-full">Reply</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!answering} onOpenChange={() => setAnswering(null)}>
        <DialogContent className="max-w-lg radius-lg p-6">
          <DialogHeader>
            <DialogTitle>Reply to Question</DialogTitle>
          </DialogHeader>
          {answering && (
            <form onSubmit={save} className="space-y-4 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Question</Label>
                <p className="text-sm font-bold text-foreground bg-secondary/10 p-3 rounded-lg border">{answering.question}</p>
              </div>
              <div>
                <Label>Your Answer *</Label>
                <Textarea 
                  required
                  rows={4} 
                  placeholder="Provide details about dimensions, shipping, or stock..."
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="submit">Publish Answer</Button>
                <Button type="button" variant="outline" onClick={() => setAnswering(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdminOrderDetail({ orderId }) {
  const router = useRouter()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const d = await res.json()
        setOrder(d)
      } else {
        toast.error('Failed to load order details')
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [orderId])

  const updateStatus = async (newStatus, extraPayload = {}) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus, ...extraPayload })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Status updated to ${newStatus.toUpperCase()}`)
        load()
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDownloadInvoice = () => {
    import('@/lib/invoice').then(({ downloadInvoice }) => {
      downloadInvoice(order)
    }).catch(err => {
      console.error(err)
      toast.error('Failed to generate invoice')
    })
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading order details...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold">Order not found</h2>
        <Button onClick={() => router.push('/admin/orders')} className="mt-4 rounded-full">Back to Orders</Button>
      </div>
    )
  }

  const statuses = ['pending', 'confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'rejected', 'cancelled', 'vendor_rejected']
  
  const totalVal = order.total || 0
  const subtotalVal = order.subtotal || totalVal
  const shippingVal = order.shipping_fee || 0
  const discountVal = order.discount || 0
  
  const supplierState = 'Maharashtra'
  const customerState = order.address?.state || ''
  const sameState = !customerState || customerState.trim().toLowerCase() === supplierState.toLowerCase()

  const gstBreakdown = order.gst_breakdown || null
  const totalTaxable = gstBreakdown?.totalTaxable ?? (
    (order.items || []).reduce((sum, item) => {
      const rate = item.gst_percent !== undefined ? Number(item.gst_percent) : 18
      const itemTotal = (item.price_snapshot || 0) * (item.quantity || 1)
      return sum + (rate > 0 ? itemTotal / (1 + rate / 100) : itemTotal)
    }, 0)
  )

  const totalCGST = gstBreakdown?.totalCGST ?? (sameState ? (subtotalVal - discountVal - totalTaxable) / 2 : 0)
  const totalSGST = gstBreakdown?.totalSGST ?? (sameState ? (subtotalVal - discountVal - totalTaxable) / 2 : 0)
  const totalIGST = gstBreakdown?.totalIGST ?? (!sameState ? (subtotalVal - discountVal - totalTaxable) : 0)

  return (
    <div className="space-y-6 slide-up pb-12">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 24px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <button onClick={() => router.push('/admin/orders')} className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 mb-2">
            &larr; Back to Orders List
          </button>
          <h1 className="font-display text-3xl font-extrabold">Order #{order.order_number}</h1>
          <p className="text-xs text-muted-foreground">Placed on {new Date(order.placed_at).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {order.zoho_invoice_id && (
            <Button
              onClick={() => {
                const token = localStorage.getItem('token')
                const link = document.createElement('a')
                link.href = `/api/zoho/invoice/${order.zoho_invoice_id}`
                link.setAttribute('download', `invoice-${order.order_number}.pdf`)
                link.click()
              }}
              variant="outline"
              className="rounded-full text-xs gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Zoho Invoice
            </Button>
          )}
          {order.zoho_challan_id && (
            <Button
              onClick={() => {
                const link = document.createElement('a')
                link.href = `/api/zoho/challan/${order.zoho_challan_id}`
                link.setAttribute('download', `challan-${order.order_number}.pdf`)
                link.click()
              }}
              variant="outline"
              className="rounded-full text-xs gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Delivery Challan
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" className="rounded-full">
            Print Invoice
          </Button>
          <Button onClick={handleDownloadInvoice} className="rounded-full">
            Download Invoice (PDF)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)] gap-5 no-print">
        <div className="min-w-0 space-y-5">
          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-4">Order Items</h3>
              <div className="divide-y">
                {order.items?.map((it, i) => (
                  <div key={i} className="py-4 flex gap-4 items-center">
                    <img src={it.image} alt="" className="w-12 h-14 object-cover rounded-lg border bg-secondary/15 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm leading-snug">{it.product_name_snapshot}</p>
                      <p className="text-xs text-muted-foreground mt-1">Qty {it.quantity} &times; {formatINR(it.price_snapshot)}</p>
                    </div>
                    <span className="font-bold text-sm text-foreground">{formatINR(it.price_snapshot * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-6">Tracking Timeline</h3>
              <div className="relative pl-6 border-l-2 border-primary/20 space-y-5">
                {order.status_history?.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                    <div>
                      <p className="text-sm font-bold text-foreground capitalize">{(step.status || '').replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.note}</p>
                      <span className="text-[10px] text-muted-foreground/60 block mt-1">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
                {(!order.status_history || order.status_history.length === 0) && (
                  <p className="text-xs text-muted-foreground py-4">No status history available yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6">
              <h3 className="font-display font-extrabold text-lg flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-accent" /> Order Activity
              </h3>
              <div className="text-xs space-y-3">
                {order.status_history?.slice(-5).reverse().map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground capitalize">{(step.status || '').replace(/_/g, ' ')}</p>
                      <p className="text-muted-foreground mt-0.5">{step.note}</p>
                      <span className="text-[10px] text-muted-foreground/50 block mt-0.5">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
                {(!order.status_history || order.status_history.length === 0) && (
                  <p className="text-muted-foreground">No activity recorded yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* 1. Admin Review: Approve / Reject Controls */}
          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-extrabold text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" /> Admin Decision & Approval
              </h3>
              <div className="bg-secondary/30 p-3 rounded-xl border flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase font-bold">Current Status</span>
                <Badge className="capitalize rounded-full font-bold">{(order.status || '').replace(/_/g, ' ')}</Badge>
              </div>

              {order.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={() => updateStatus('confirmed')}
                    className="rounded-xl h-10 font-extrabold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Order
                  </Button>
                  <Button
                    onClick={() => updateStatus('rejected')}
                    variant="outline"
                    className="rounded-xl h-10 font-extrabold text-xs border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject Order
                  </Button>
                </div>
              ) : (
                <div className="pt-2">
                  {order.status === 'rejected' ? (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-extrabold p-3.5 rounded-xl">
                      <XCircle className="w-4 h-4" /> ❌ Rejected: {order.rejection_reason || 'Order rejected by Admin.'}
                    </div>
                  ) : order.status === 'delivered' ? (
                    <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-extrabold p-3.5 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" /> ✅ Completed (Delivered)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold p-3.5 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" /> ✅ Approved (Fulfillment In Progress)
                    </div>
                  )}
                </div>
              )}

              {order.status === 'pending' && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block font-semibold">Manual Status Override</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {statuses.map(st => (
                      <Button
                        key={st}
                        onClick={() => updateStatus(st)}
                        variant={order.status === st ? 'default' : 'outline'}
                        size="sm"
                        className="capitalize rounded-full text-xs"
                      >
                        {st.replace(/_/g, ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Assigned Logistics Partner Card (Read-only display replacing manual assign and notes) */}
          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-extrabold text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-accent" /> Logistics Partner
              </h3>
              <div className="p-4 rounded-xl bg-secondary/50 border space-y-2">
                {order.vendor_name ? (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Assigned Partner Unit</span>
                    <span className={`font-semibold text-sm block ${order.vendor_name.includes('No vendor') ? 'text-destructive font-bold' : 'text-foreground'}`}>
                      {order.vendor_name}
                    </span>
                    {order.vendor_email && (
                      <span className="text-xs text-muted-foreground font-mono block mt-1">
                        {order.vendor_email}
                      </span>
                    )}
                    {order.assigned_at && (
                      <div className="pt-2 mt-2 border-t text-[10px] text-muted-foreground">
                        Assigned on {new Date(order.assigned_at).toLocaleString('en-IN')} by {order.assigned_by || 'System'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Fulfillment Status</span>
                    <span className="font-semibold text-xs text-destructive mt-1 block">
                      No vendor assigned to this customer — please assign one in Customer Pricing
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-extrabold text-lg">Customer & Shipping</h3>
              <div className="text-xs space-y-2">
                <div>
                  <span className="text-muted-foreground block uppercase font-bold text-[9px]">Full Name</span>
                  <span className="font-semibold text-sm">{order.address?.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-bold text-[9px]">Phone Number</span>
                  <span className="font-semibold text-sm font-mono">{order.address?.phone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-bold text-[9px]">Email Address</span>
                  <span className="font-semibold text-sm">{order.user_email || 'Guest user'}</span>
                </div>
                {order.address?.gst && (
                  <div>
                    <span className="text-muted-foreground block uppercase font-bold text-[9px]">GSTIN</span>
                    <span className="font-semibold text-sm font-mono text-primary">{order.address.gst}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block uppercase font-bold text-[9px] mb-1">Shipping Address</span>
                  <p className="text-sm font-medium leading-relaxed text-foreground/80">
                    {order.address?.line1}<br />
                    {order.address?.line2 && <>{order.address.line2}<br /></>}
                    {order.address?.city}, {order.address?.state} {order.address?.pincode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-extrabold text-lg">Financial Breakdown</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-semibold">{formatINR(subtotalVal)}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount</span>
                    <span className="font-semibold">- {formatINR(discountVal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping Fee</span>
                  <span className="font-semibold">{shippingVal === 0 ? 'FREE' : formatINR(shippingVal)}</span>
                </div>
                <div className="pt-2 border-t flex justify-between font-display font-black text-base text-primary">
                  <span>Grand Total</span>
                  <span>{formatINR(totalVal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div id="printable-invoice" className="hidden print:block text-black bg-white text-xs leading-relaxed max-w-4xl mx-auto">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-black">AK Enterprises</h1>
            <p className="font-bold">B2B Corporate Supplier</p>
            <p className="text-[10px] text-gray-600">Address: Pune - 411004 | Maharashtra, India</p>
            <p className="text-[10px] text-gray-600">Phone: +91 83088 60894 | Email: akenterprises1411@gmail.com</p>
            <p className="text-[10px] font-bold text-black mt-1">GSTIN: 27AAFFA1234F1Z5</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-700">TAX INVOICE</h2>
            <p className="mt-2 font-bold">Invoice No: <span className="font-mono">{order.order_number}</span></p>
            <p>Invoice Date: {new Date(order.placed_at).toLocaleDateString('en-IN')}</p>
            <p className="font-bold mt-1 text-gray-700">Payment Mode: Cash on Delivery (COD)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6 border-b pb-4">
          <div>
            <h3 className="font-bold text-[10px] uppercase text-gray-500 mb-2">Billing / Shipping Details</h3>
            <p className="font-bold text-sm text-black">{order.address?.full_name}</p>
            <p className="font-semibold text-gray-700">Phone: {order.address?.phone}</p>
            <p className="text-gray-600">
              {order.address?.line1}<br />
              {order.address?.line2 && <>{order.address.line2}<br /></>}
              {order.address?.city}, {order.address?.state} - {order.address?.pincode}
            </p>
            {order.address?.gst && <p className="font-bold text-black mt-1">Buyer GSTIN: {order.address.gst}</p>}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-[10px] uppercase text-gray-500 mb-2">Order Information</h3>
            <p>Order ID: <span className="font-mono">{order.id}</span></p>
            <p>Order Status: <span className="font-bold uppercase">{order.status}</span></p>
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-gray-300 mb-6 text-[11px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-700">
              <th className="p-2 border-r border-gray-300 font-bold w-12 text-center">S.No</th>
              <th className="p-2 border-r border-gray-300 font-bold">Item Description</th>
              <th className="p-2 border-r border-gray-300 font-bold text-center w-16">Qty</th>
              <th className="p-2 border-r border-gray-300 font-bold text-right w-24">Unit Price</th>
              <th className="p-2 font-bold text-right w-24">Total Value</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((it, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="p-2 border-r border-gray-300 text-center">{idx + 1}</td>
                <td className="p-2 border-r border-gray-300 font-bold text-black">{it.product_name_snapshot}</td>
                <td className="p-2 border-r border-gray-300 text-center font-bold">{it.quantity}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">₹{it.price_snapshot.toFixed(2)}</td>
                <td className="p-2 text-right font-mono font-bold">₹{(it.price_snapshot * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <table className="w-64 text-right text-[11px]">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Taxable Value:</td>
                <td className="py-1 font-mono">₹{totalTaxable.toFixed(2)}</td>
              </tr>
              {sameState ? (
                <>
                  <tr>
                    <td className="py-1 text-gray-600">CGST (incl.):</td>
                    <td className="py-1 font-mono">₹{totalCGST.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-600">SGST (incl.):</td>
                    <td className="py-1 font-mono">₹{totalSGST.toFixed(2)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="py-1 text-gray-600">IGST (incl.):</td>
                  <td className="py-1 font-mono">₹{totalIGST.toFixed(2)}</td>
                </tr>
              )}
              <tr className="border-t border-dashed">
                <td className="py-1 font-bold">Total Items Value:</td>
                <td className="py-1 font-mono font-bold">₹{subtotalVal.toFixed(2)}</td>
              </tr>
              {discountVal > 0 && (
                <tr className="text-emerald-700">
                  <td className="py-1 font-bold">Discount Applied:</td>
                  <td className="py-1 font-mono font-bold">- ₹{discountVal.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 text-gray-600">Shipping Charges:</td>
                <td className="py-1 font-mono">{shippingVal === 0 ? 'FREE' : `₹${shippingVal.toFixed(2)}`}</td>
              </tr>
              <tr className="border-t-2 border-black text-black font-bold text-sm">
                <td className="py-2 text-left pr-4">Grand Total (COD):</td>
                <td className="py-2 font-mono">₹{totalVal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t pt-4 text-center text-gray-500 text-[10px] space-y-1">
          <p className="font-bold text-black">Thank you for your business with AK Enterprises!</p>
          <p>This is a computer-generated tax invoice. No signature required.</p>
        </div>
      </div>
    </div>
  )
}

