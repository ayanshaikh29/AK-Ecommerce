'use client'
import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { 
  LayoutDashboard, Grid3x3, Plus, Upload, ClipboardList, ImageIcon, 
  Users, Settings, LogOut, Package, TrendingUp, AlertTriangle, 
  Trash2, Video, FileText, Building2
} from 'lucide-react'
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
          {section === 'dashboard' && <AdminDashboard/>}
          {section === 'products' && <AdminProducts router={router}/>}
          {section === 'product-new' && <AdminProductForm router={router}/>}
          {section === 'product-edit' && <AdminProductForm router={router} editId={id}/>}
          {section === 'csv' && <AdminCSV/>}
          {section === 'orders' && <AdminOrders/>}
          {section === 'banners' && <AdminBanners/>}
          {section === 'clients' && <AdminClients/>}
          {section === 'settings' && <AdminSettings setSettings={setSettings}/>}
        </main>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [s, setS] = useState(null)
  useEffect(() => { 
    fetch('/api/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(setS)
      .catch(() => setS(null)) 
  }, [])
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
      <Card className="radius-lg shadow-soft"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
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
          <div className="grid grid-cols-2 gap-3">
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

function AdminOrders() {
  const [orders, setOrders] = useState(null); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState(null)
  const load = () => fetch('/api/orders' + (status !== 'all' ? `?status=${status}` : ''), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r=>r.json()).then(setOrders)
  useEffect(() => { load() }, [status])
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
      <Card className="radius-lg shadow-soft"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-secondary"><tr><th className="text-left p-3">Order #</th><th className="text-left p-3">Date</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Total</th><th className="text-left p-3">Status</th><th className="p-3"></th></tr></thead>
        <tbody>{!orders ? <tr><td colSpan="6" className="p-8 text-center">Loading...</td></tr> : orders.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-muted-foreground">No orders</td></tr> : orders.map(o => (
          <tr key={o.id} className="border-t hover:bg-secondary/50">
            <td className="p-3 font-mono font-bold">{o.order_number}</td>
            <td className="p-3">{new Date(o.placed_at).toLocaleDateString('en-IN')}</td>
            <td className="p-3">{o.address?.full_name}</td>
            <td className="p-3 font-bold">{formatINR(o.total)}</td>
            <td className="p-3"><Badge className="capitalize rounded-full">{o.status}</Badge></td>
            <td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(o)} className="rounded-full">View</Button></td>
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
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}><DialogContent className="max-w-lg radius-lg"><DialogHeader><DialogTitle className="font-display">{editing?.id ? 'Edit' : 'Add'} Banner</DialogTitle></DialogHeader>{editing && <form onSubmit={save} className="space-y-4">
        <div><Label>Title *</Label><Input required value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="h-11 rounded-xl"/></div>
        <div><Label>Subtitle</Label><Textarea value={editing.subtitle} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} rows={2} className="rounded-xl"/></div>
        <div><Label>Image</Label>{editing.image_url && <Image src={editing.image_url} alt="" width={400} height={225} className="w-full aspect-video object-cover rounded-xl mb-2" loading="lazy"/>}<FileUploader accept="image/*" label="Upload banner image" onUploaded={urls => setEditing({ ...editing, image_url: urls[0] })}/></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>CTA Text</Label><Input value={editing.cta_text} onChange={e => setEditing({ ...editing, cta_text: e.target.value })} className="h-11 rounded-xl"/></div><div><Label>CTA Link</Label><Input value={editing.cta_link} onChange={e => setEditing({ ...editing, cta_link: e.target.value })} className="h-11 rounded-xl" placeholder="/products"/></div></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>Sort Order</Label><Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} className="h-11 rounded-xl"/></div><label className="flex items-end pb-2 gap-2"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })}/>Active</label></div>
        <div className="flex gap-2"><Button type="submit" className="flex-1 rounded-full">Save</Button><Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button></div>
      </form>}</DialogContent></Dialog>
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
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}><DialogContent className="max-w-md radius-lg"><DialogHeader><DialogTitle className="font-display">{editing?.id ? 'Edit' : 'Add'} Client</DialogTitle></DialogHeader>{editing && <form onSubmit={save} className="space-y-4">
        <div><Label>Client Name *</Label><Input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="h-11 rounded-xl"/></div>
        <div><Label>Logo (optional)</Label>{editing.logo_url && <Image src={editing.logo_url} width={64} height={64} className="h-16 object-contain mb-2" alt="" loading="lazy"/>}<FileUploader accept="image/*" label="Upload logo" onUploaded={urls => setEditing({ ...editing, logo_url: urls[0] })}/></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>Sort Order</Label><Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} className="h-11 rounded-xl"/></div><label className="flex items-end pb-2 gap-2"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })}/>Active</label></div>
        <div className="flex gap-2"><Button type="submit" className="flex-1 rounded-full">Save</Button><Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button></div>
      </form>}</DialogContent></Dialog>
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact Phone</Label><Input value={f.contact_phone || ''} onChange={e => setF({ ...f, contact_phone: e.target.value })} className="h-11 rounded-xl"/></div>
            <div><Label>WhatsApp Number</Label><Input value={f.whatsapp_number || ''} onChange={e => setF({ ...f, whatsapp_number: e.target.value })} className="h-11 rounded-xl" placeholder="918308860894"/></div>
            <div className="col-span-2"><Label>Email</Label><Input value={f.contact_email || ''} onChange={e => setF({ ...f, contact_email: e.target.value })} className="h-11 rounded-xl"/></div>
            <div className="col-span-2"><Label>Address</Label><Textarea value={f.contact_address || ''} onChange={e => setF({ ...f, contact_address: e.target.value })} rows={2} className="rounded-xl"/></div>
            <div className="col-span-2"><Label>Contact Person</Label><Input value={f.contact_person || ''} onChange={e => setF({ ...f, contact_person: e.target.value })} className="h-11 rounded-xl"/></div>
          </div>
        </CardContent></Card>

        <div className="sticky bottom-4 glass-strong border radius-lg p-3 shadow-elevated"><Button type="submit" size="lg" disabled={loading} className="w-full rounded-full btn-shine">{loading ? <><span className="btn-spinner mr-2"/>Saving...</> : 'Save All Settings'}</Button></div>
      </form>
    </div>
  )
}
