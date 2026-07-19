'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Plus, Trash2, Edit3, CheckCircle, Home, Loader2, ArrowLeft, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/components/providers/AppProvider'

export default function AddressesPage() {
  const { user } = useAppContext()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    is_default: false
  })

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/addresses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAddresses(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    if (mounted && !user) {
      router.push('/login?redirect=/account/addresses')
      return
    }
    if (user) {
      fetchAddresses()
    }
  }, [user, mounted])

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const handleOpenAdd = () => {
    setForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      is_default: addresses.length === 0 // default true for first address
    })
    setEditingId(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (addr) => {
    setForm({
      full_name: addr.full_name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      is_default: addr.is_default
    })
    setEditingId(addr.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validation
    for (const key of ['full_name', 'phone', 'line1', 'city', 'state', 'pincode']) {
      if (!form[key]) {
        toast.error(`Please fill in ${key.replace('_', ' ')}`)
        return
      }
    }

    setLoading(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/addresses/${editingId}` : '/api/addresses'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Address save details:', errData.error || errData)
        throw new Error('Could not save your address. Please verify your profile info or try signing out and in again.')
      }
      
      toast.success(editingId ? 'Address updated' : 'Address added successfully!')
      setFormOpen(false)
      fetchAddresses()
    } catch (err) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this address?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) throw new Error('Failed to delete address')
      toast.success('Address deleted')
      fetchAddresses()
    } catch (err) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  const handleSetDefault = async (addr) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/addresses/${addr.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...addr, is_default: true })
      })
      if (!res.ok) throw new Error('Failed to set default')
      toast.success('Default address updated')
      fetchAddresses()
    } catch (err) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/account" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Saved Addresses</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Manage your delivery and billing locations</p>
          </div>
        </div>
        <Button onClick={handleOpenAdd} size="sm" className="rounded-full h-10 px-4 flex items-center gap-1.5 shadow-sm">
          <Plus className="w-4.5 h-4.5" /> Add New
        </Button>
      </div>

      {loading && addresses.length === 0 ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-24 border rounded-3xl border-dashed border-border/80 bg-secondary/10">
          <div className="max-w-xs mx-auto">
            <MapPin className="w-12 h-12 text-muted-foreground/35 mx-auto mb-4" />
            <p className="font-display font-extrabold text-xl mb-1">No addresses saved</p>
            <p className="text-xs text-muted-foreground mb-6">Add a shipping address to speed up checkout.</p>
            <Button size="sm" onClick={handleOpenAdd} className="rounded-full">Add Shipping Address</Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 slide-up">
          {addresses.map(addr => (
            <Card 
              key={addr.id} 
              className={`border transition-all duration-300 ${addr.is_default ? 'border-primary/50 shadow-soft bg-card/75' : 'border-border/50 hover:border-border/80 bg-card/45'}`}
            >
              <CardContent className="p-6 flex flex-col justify-between h-full min-h-[220px]">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-base">{addr.full_name}</span>
                      {addr.is_default && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                    <p className="text-foreground/90 font-medium">{addr.phone}</p>
                    <p className="line-clamp-2">{addr.line1}</p>
                    {addr.line2 && <p className="line-clamp-1">{addr.line2}</p>}
                    <p>{addr.city}, {addr.state} - <span className="font-semibold text-foreground">{addr.pincode}</span></p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-5 mt-4 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenEdit(addr)}
                      className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <span className="text-muted-foreground/30 text-xs">|</span>
                    <button 
                      onClick={() => handleDelete(addr.id)}
                      className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                  
                  {!addr.is_default && (
                    <button 
                      onClick={() => handleSetDefault(addr)}
                      className="text-xs font-bold text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Set as Default
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 fade-in">
          <Card 
            className="w-full max-w-lg bg-card border shadow-dramatic radius-xl scale-in overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-xl mb-5">
                {editingId ? 'Edit Address' : 'Add New Address'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Contact Name</Label>
                    <Input 
                      id="full_name"
                      value={form.full_name} 
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} 
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone"
                      value={form.phone} 
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                      placeholder="10-digit phone number"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="line1">Address Line 1</Label>
                  <Input 
                    id="line1"
                    value={form.line1} 
                    onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} 
                    placeholder="Flat, House no., Building, Company, Street"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                  <Input 
                    id="line2"
                    value={form.line2} 
                    onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} 
                    placeholder="Area, Colony, Sector, Landmark"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city"
                      value={form.city} 
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))} 
                      placeholder="City"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Input 
                      id="state"
                      value={form.state} 
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))} 
                      placeholder="State"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input 
                      id="pincode"
                      value={form.pincode} 
                      onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} 
                      placeholder="6-digit PIN"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox"
                    id="is_default"
                    checked={form.is_default}
                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                    className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                  />
                  <Label htmlFor="is_default" className="cursor-pointer select-none">Set as Default Shipping Address</Label>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setFormOpen(false)} 
                    className="flex-1 rounded-full h-11"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-full h-11" 
                    disabled={loading}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                    Save Address
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
