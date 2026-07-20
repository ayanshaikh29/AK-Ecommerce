'use client'
import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { 
  LayoutDashboard, Grid3x3, Plus, Upload, ClipboardList, ImageIcon, 
  Users, Settings, LogOut, Package, TrendingUp, AlertTriangle, 
  Trash2, Video, FileText, Building2, Bell, BellRing, Menu, X, MessageSquare,
  Loader2
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

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
  const [unreadOrders, setUnreadOrders] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [supabaseClient, setSupabaseClient] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  // Subscribe to realtime orders INSERT events
  useEffect(() => {
    if (!supabaseClient) return
    
    const channel = supabaseClient
      .channel('realtime-admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newOrder = payload.new
          
          // Play a notification sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav')
            audio.play()
          } catch (e) {
            console.log('Audio play blocked or failed:', e)
          }

          let customerName = 'Customer'
          try {
            const { data: addr } = await supabaseClient
              .from('addresses')
              .select('full_name')
              .eq('id', newOrder.address_id)
              .maybeSingle()
            if (addr?.full_name) {
              customerName = addr.full_name
            }
          } catch (e) {
            console.error(e)
          }

          const orderWithCustomer = { ...newOrder, customerName }

          // Trigger a toast notification
          toast.success(`New Order #${newOrder.order_number}!`, {
            description: `Placed by ${customerName} for ₹${newOrder.total}.`
          })

          // Add to unread orders array
          setUnreadOrders(prev => [orderWithCustomer, ...prev])

          // Trigger refresh of list/stats
          setRefreshTrigger(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [supabaseClient])
  
  useEffect(() => { 
    const check = async () => { 
      if (!user) { router.push('/login'); return } 
      try { 
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        if (!res.ok) throw new Error('Access denied')
        const { user: u } = await res.json()
        if (u?.role !== 'admin') { toast.error('Access denied'); setUser(null); localStorage.removeItem('token'); router.push('/login'); return } 
        setAuthChecked(true) 
      } catch { 
        setUser(null)
        localStorage.removeItem('token')
        router.push('/login') 
      } 
    }; 
    check() 
  }, [user, router, setUser])
  
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-lg">Checking access...</div></div>

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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
                  ['products','Products',Grid3x3],
                  ['product-new','Add Product',Plus],
                  ['csv','CSV Import',Upload],
                  ['orders','Orders',ClipboardList],
                  ['banners','Hero Banners',ImageIcon],
                  ['clients','Clients',Users],
                  ['faqs','FAQ Manager',FileText],
                  ['chat-logs','Chat Logs',MessageSquare],
                  ['reports','Sales Reports',TrendingUp],
                  ['customers','VIP Customers',Users],
                  ['product-qa','Product Q&A',MessageSquare],
                  ['settings','Site Settings',Settings]
                ].map(([s,l,I]) => (
                  <button 
                    key={s} 
                    onClick={() => { router.push('/admin/' + s); setMobileMenuOpen(false) }} 
                    className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${section === s || (s === 'products' && section === 'product-edit') ? 'gold-gradient text-primary font-bold' : 'text-white/80 hover:bg-white/10'}`}
                  >
                    <I className="w-4 h-4"/>{l}
                  </button>
                ))}
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
        <aside className="w-64 mesh-dark text-white p-4 hidden md:block min-h-screen sticky top-0">
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
              ['products','Products',Grid3x3],
              ['product-new','Add Product',Plus],
              ['csv','CSV Import',Upload],
              ['orders','Orders',ClipboardList],
              ['banners','Hero Banners',ImageIcon],
              ['clients','Clients',Users],
              ['faqs','FAQ Manager',FileText],
              ['chat-logs','Chat Logs',MessageSquare],
              ['reports','Sales Reports',TrendingUp],
              ['customers','VIP Customers',Users],
              ['product-qa','Product Q&A',MessageSquare],
              ['settings','Site Settings',Settings]
            ].map(([s,l,I]) => (
              <button 
                key={s} 
                onClick={() => router.push('/admin/' + s)} 
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${section === s || (s === 'products' && section === 'product-edit') ? 'gold-gradient text-primary font-bold' : 'text-white/80 hover:bg-white/10'}`}
              >
                <I className="w-4 h-4"/>{l}
              </button>
            ))}
            <button onClick={logout} className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 mt-6"><LogOut className="w-4 h-4"/>Sign out</button>
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden page-transition" key={section + (id || '')}>
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
                <h2 className="font-display font-extrabold text-xl md:text-2xl capitalize">{section.replace('-', ' ')}</h2>
                <p className="text-[10px] md:text-xs text-muted-foreground">Welcome back, Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                Live
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-secondary/50 transition relative"
                >
                  {unreadOrders.length > 0 ? (
                    <>
                      <BellRing className="w-5 h-5 text-accent animate-bounce" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadOrders.length}
                      </span>
                    </>
                  ) : (
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-card border rounded-2xl shadow-elevated z-50 p-4 divide-y">
                    <div className="pb-2 flex justify-between items-center">
                      <span className="font-display font-bold text-sm">Notifications</span>
                      {unreadOrders.length > 0 && (
                        <button onClick={() => setUnreadOrders([])} className="text-xs text-muted-foreground hover:text-primary transition">Clear all</button>
                      )}
                    </div>
                    <div className="pt-2 max-h-60 overflow-y-auto space-y-2">
                      {unreadOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No new notifications</p>
                      ) : (
                        unreadOrders.map((ord, idx) => (
                          <div key={idx} className="text-xs py-2 flex flex-col gap-0.5">
                            <div className="flex justify-between font-bold">
                              <span>Order #{ord.order_number}</span>
                              <span className="text-accent">₹{ord.total}</span>
                            </div>
                            <p className="text-muted-foreground font-medium">Placed by {ord.customerName || 'Customer'}</p>
                            <p className="text-[10px] text-muted-foreground/60">{new Date(ord.placed_at).toLocaleTimeString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {section === 'dashboard' && <AdminDashboard refreshTrigger={refreshTrigger}/>}
          {section === 'products' && <AdminProducts router={router}/>}
          {section === 'product-new' && <AdminProductForm router={router}/>}
          {section === 'product-edit' && <AdminProductForm router={router} editId={id}/>}
          {section === 'csv' && <AdminCSV/>}
          {section === 'orders' && (id ? <AdminOrderDetail orderId={id}/> : <AdminOrders refreshTrigger={refreshTrigger} router={router}/>)}
          {section === 'banners' && <AdminBanners/>}
          {section === 'clients' && <AdminClients/>}
          {section === 'faqs' && <AdminFAQs/>}
          {section === 'chat-logs' && <AdminChatLogs/>}
          {section === 'reports' && <AdminReports/>}
          {section === 'customers' && <AdminCustomers/>}
          {section === 'product-qa' && <AdminQA/>}
          {section === 'settings' && <AdminSettings setSettings={setSettings}/>}
        </main>
      </div>
    </div>
  )
}

function AdminDashboard({ refreshTrigger }) {
  const [s, setS] = useState(null)
  useEffect(() => { 
    fetch('/api/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(setS)
      .catch(() => setS(null)) 
  }, [refreshTrigger])
  if (!s) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array(4).fill(0).map((_,i) => <div key={i} className="h-24 skeleton"/>)}</div>
  const cards = [['Products',s.products,Grid3x3],['Orders',s.orders,Package],['Pending',s.pending,ClipboardList],['Revenue',formatINR(s.revenue),TrendingUp]]
  const max = Math.max(1, ...Object.values(s.byDay))
  return (
    <div className="slide-up">
      <h1 className="font-display text-4xl font-extrabold mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(([l,v,I],i) => (
          <Card key={l} className="radius-lg shadow-soft card-lift overflow-hidden relative slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <CardContent className="pt-6">
              <div className="absolute top-0 right-0 w-24 h-24 gold-gradient opacity-10 rounded-full -mr-8 -mt-8"/>
              <I className="w-5 h-5 text-accent mb-3"/>
              <p className="font-display text-3xl font-extrabold">{v}</p>
              <p className="text-sm text-muted-foreground">{l}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6"><h3 className="font-display font-extrabold mb-4">Orders — Last 7 days</h3><div className="flex items-end gap-2 h-40">{Object.entries(s.byDay).map(([k,v]) => (<div key={k} className="flex-1 flex flex-col items-center gap-1"><div className="w-full gold-gradient rounded-t-lg transition-all shadow-soft" style={{ height: `${(v / max) * 100}%`, minHeight: '4px' }}/><span className="text-[10px] text-muted-foreground">{k.slice(5)}</span><span className="text-xs font-bold">{v}</span></div>))}</div></CardContent></Card>
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6"><h3 className="font-display font-extrabold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive"/>Low Stock Alert</h3>{s.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">All well-stocked.</p> : <div className="space-y-2">{s.lowStock.map((p,i) => (<div key={i} className="flex justify-between text-sm slide-up" style={{ animationDelay: `${i * 40}ms` }}><span className="line-clamp-1">{p.name}</span><Badge variant={p.stock_quantity === 0 ? 'destructive' : 'secondary'}>{p.stock_quantity} left</Badge></div>))}</div>}</CardContent></Card>
      </div>
    </div>
  )
}

function AdminProducts({ router }) {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const load = () => fetch('/api/products').then(r=>r.json()).then(setList)
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
  const filtered = list?.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())) || []
  return (
    <div className="slide-up">
      <div className="flex justify-between items-center mb-6"><h1 className="font-display text-4xl font-extrabold">Products <span className="text-muted-foreground text-lg">({list?.length || 0})</span></h1><Button onClick={() => router.push('/admin/product-new')} className="rounded-full btn-shine"><Plus className="w-4 h-4 mr-1"/>Add Product</Button></div>
      <Input placeholder="Search products..." value={q} onChange={e => setQ(e.target.value)} className="mb-4 max-w-sm h-11 rounded-xl"/>
      <Card className="radius-lg shadow-soft"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm min-w-[800px]">
        <thead className="bg-secondary"><tr><th className="text-left p-3">Product</th><th className="text-left p-3">Price</th><th className="text-left p-3">Stock</th><th className="text-left p-3">Media</th><th className="text-left p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
        <tbody>{!list ? <tr><td colSpan="6" className="p-8 text-center">Loading...</td></tr> : filtered.map(p => (
          <tr key={p.id} className="border-t hover:bg-secondary/50 transition">
            <td className="p-3"><div className="flex items-center gap-2"><Image src={p.images?.[0]} width={40} height={48} className="w-10 h-12 object-cover rounded-lg" alt="" loading="lazy"/><span className="line-clamp-1 max-w-xs">{p.name}</span></div></td>
            <td className="p-3 font-semibold">{formatINR(p.price)}</td>
            <td className="p-3"><Badge variant={p.stock_quantity < 10 ? 'destructive' : 'secondary'}>{p.stock_quantity}</Badge></td>
            <td className="p-3"><div className="flex gap-1 items-center text-xs"><ImageIcon className="w-3 h-3"/>{p.images?.length || 0}{p.videos?.length > 0 && <><Video className="w-3 h-3 ml-1"/>{p.videos.length}</>}</div></td>
            <td className="p-3"><button onClick={() => toggle(p)}><Badge variant={p.is_active ? 'default' : 'secondary'} className="rounded-full">{p.is_active ? 'Active' : 'Inactive'}</Badge></button></td>
            <td className="p-3 text-right space-x-1"><Button size="sm" variant="outline" onClick={() => router.push('/admin/product-edit/' + p.id)} className="rounded-full">Edit</Button><Button size="sm" variant="ghost" onClick={() => del(p.id)} className="rounded-full"><Trash2 className="w-4 h-4 text-destructive"/></Button></td>
          </tr>
        ))}</tbody>
      </table></CardContent></Card>
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
  const [f, setF] = useState({ name: '', description: '', price: '', mrp: '', category_id: '', subcategory: '', stock_quantity: '', sku: '', is_featured: false, is_active: true, images: [], videos: [] })
  const [cats, setCats] = useState([])
  useEffect(() => { fetch('/api/categories').then(r=>r.json()).then(setCats) }, [])
  useEffect(() => { if (editId) fetch('/api/products/' + editId).then(r=>r.json()).then(p => setF({ ...p, images: p.images || [], videos: p.videos || [] })) }, [editId])
  const save = async e => {
    e.preventDefault()
    const body = { ...f, price: +f.price, mrp: +f.mrp, stock_quantity: +f.stock_quantity }
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
    <div className="max-w-4xl slide-up">
      <h1 className="font-display text-4xl font-extrabold mb-6">{editId ? 'Edit' : 'Add'} Product</h1>
      <form onSubmit={save} className="space-y-6">
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold flex items-center gap-2 text-lg"><FileText className="w-5 h-5"/>Basic Info</h3>
          <div><Label>Product Name *</Label><Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="h-11 rounded-xl"/></div>
          <div><Label>Description</Label><Textarea rows={4} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className="rounded-xl"/></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Category *</Label><Select value={f.category_id} onValueChange={v => setF({ ...f, category_id: v })}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Sub-category</Label><Input value={f.subcategory} onChange={e => setF({ ...f, subcategory: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Price (₹) *</Label><Input required type="number" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>MRP (₹)</Label><Input type="number" value={f.mrp} onChange={e => setF({ ...f, mrp: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>Stock *</Label><Input required type="number" value={f.stock_quantity} onChange={e => setF({ ...f, stock_quantity: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>SKU</Label><Input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} className="h-11 rounded-xl"/></div>
          </div>
          <div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.is_featured} onChange={e => setF({ ...f, is_featured: e.target.checked })}/>Featured</label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })}/>Active</label></div>
        </CardContent></Card>

        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold flex items-center gap-2 text-lg"><ImageIcon className="w-5 h-5"/>Product Images</h3>
          <FileUploader accept="image/*" multiple label="Click to upload images" onUploaded={urls => setF(prev => ({ ...prev, images: [...prev.images, ...urls] }))}/>
          {f.images.length > 0 && <div className="grid grid-cols-4 md:grid-cols-6 gap-3">{f.images.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border scale-in"><Image src={url} alt="" fill className="object-cover" loading="lazy" sizes="(max-width: 768px) 25vw, 15vw"/><button type="button" onClick={() => removeImg(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><Trash2 className="w-5 h-5 text-white"/></button></div>
          ))}</div>}
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
  const [orders, setOrders] = useState(null); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState(null)
  const load = () => fetch('/api/orders' + (status !== 'all' ? `?status=${status}` : ''), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r=>r.json()).then(setOrders)
  useEffect(() => { load() }, [status, refreshTrigger])
  const updateStatus = async (id, newStatus) => { 
    try { 
      await fetch('/api/orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ status: newStatus }) })
      toast.success('Updated'); 
      load(); 
      setSelected(null) 
    } catch (e) { toast.error(e.message) } 
  }
  const statuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']
  return (
    <div className="slide-up">
      <div className="flex justify-between items-center mb-6"><h1 className="font-display text-4xl font-extrabold">Orders</h1>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40 rounded-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card className="radius-lg shadow-soft"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm min-w-[800px]">
        <thead className="bg-secondary"><tr><th className="text-left p-3">Order #</th><th className="text-left p-3">Date</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Total</th><th className="text-left p-3">Status</th><th className="p-3"></th></tr></thead>
        <tbody>{!orders ? <tr><td colSpan="6" className="p-8 text-center">Loading...</td></tr> : orders.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-muted-foreground">No orders</td></tr> : orders.map(o => (
          <tr key={o.id} className="border-t hover:bg-secondary/50">
            <td className="p-3 font-mono font-bold">{o.order_number}</td>
            <td className="p-3">{new Date(o.placed_at).toLocaleDateString('en-IN')}</td>
            <td className="p-3">{o.address?.full_name}</td>
            <td className="p-3 font-bold">{formatINR(o.total)}</td>
            <td className="p-3"><Badge className="capitalize rounded-full">{o.status}</Badge></td>
            <td className="p-3"><Button size="sm" variant="outline" onClick={() => router.push(`/admin/orders/${o.id}`)} className="rounded-full">View</Button></td>
          </tr>
        ))}</tbody>
      </table></CardContent></Card>
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto radius-lg"><DialogHeader><DialogTitle className="font-display">Order {selected?.order_number}</DialogTitle></DialogHeader>{selected && <div className="space-y-4">
        <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-semibold">{selected.address.full_name} — {selected.address.phone}</p><p className="text-sm">{selected.address.line1}, {selected.address.line2 && selected.address.line2 + ', '}{selected.address.city}, {selected.address.state} {selected.address.pincode}</p>{selected.address.gst && <p className="text-xs mt-1">GST: {selected.address.gst}</p>}</div>
        <div><p className="text-sm text-muted-foreground mb-1">Items</p>{selected.items.map((it, i) => <div key={i} className="flex gap-2 py-1"><Image src={it.image} width={40} height={48} className="w-10 h-12 object-cover rounded-lg" alt="" loading="lazy"/><div className="flex-1 text-sm"><p>{it.product_name_snapshot}</p><p className="text-muted-foreground">Qty {it.quantity} · {formatINR(it.price_snapshot)}</p></div></div>)}</div>
        <div className="flex justify-between font-display font-extrabold text-lg"><span>Total (COD)</span><span>{formatINR(selected.total)}</span></div>
        <div><p className="text-sm mb-2">Update status:</p><div className="flex flex-wrap gap-2">{statuses.map(s => <Button key={s} size="sm" variant={selected.status === s ? 'default' : 'outline'} onClick={() => updateStatus(selected.id, s)} className="capitalize rounded-full">{s}</Button>)}</div></div>
      </div>}</DialogContent></Dialog>
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

  const updateStatus = async (newStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        toast.success('Status updated successfully')
        load()
      } else {
        toast.error('Failed to update status')
      }
    } catch (e) {
      toast.error(e.message)
    }
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

  const statuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']
  
  const totalVal = order.total || 0
  const subtotalVal = order.subtotal || totalVal
  const shippingVal = order.shipping_fee || 0
  const discountVal = order.discount || 0
  
  const gstRate = 0.18
  const taxableSubtotal = (subtotalVal - discountVal) / (1 + gstRate)
  const gstAmt = (subtotalVal - discountVal) - taxableSubtotal
  const cgst = gstAmt / 2
  const sgst = gstAmt / 2

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
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" className="rounded-full">
            Print Invoice
          </Button>
          <Button onClick={handlePrint} className="rounded-full">
            Download Invoice (PDF)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <div className="lg:col-span-2 space-y-6">
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
              <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
                {order.status_history?.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                    <div>
                      <p className="text-sm font-bold text-foreground capitalize">{step.status}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.note}</p>
                      <span className="text-[10px] text-muted-foreground/60 block mt-1">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="radius-xl shadow-soft border">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-extrabold text-lg">Order Status</h3>
              <div className="bg-secondary/30 p-3 rounded-xl border flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase font-bold">Current</span>
                <Badge className="capitalize rounded-full font-bold">{order.status}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block font-semibold">Change Status To</Label>
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map(st => (
                    <Button
                      key={st}
                      onClick={() => updateStatus(st)}
                      variant={order.status === st ? 'default' : 'outline'}
                      size="sm"
                      className="capitalize rounded-full text-xs"
                    >
                      {st}
                    </Button>
                  ))}
                </div>
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
                <td className="py-1 font-mono">₹{taxableSubtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">CGST (9%):</td>
                <td className="py-1 font-mono">₹{cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">SGST (9%):</td>
                <td className="py-1 font-mono">₹{sgst.toFixed(2)}</td>
              </tr>
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

