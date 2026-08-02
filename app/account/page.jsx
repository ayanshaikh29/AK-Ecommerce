'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, MapPin, Heart, HelpCircle, User, LogOut, Calendar, Edit2, Loader2, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/components/providers/AppProvider'

export default function AccountPage() {
  const { user, setUser, logout } = useAppContext()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ 
    full_name: '', 
    email: '', 
    phone: '', 
    gst_number: '',
    company_name: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  })

  useEffect(() => {
    setMounted(true)
    if (mounted && !user) {
      router.push('/login?redirect=/account')
    }
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        gst_number: user.gst_number || '',
        company_name: user.company_name || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || ''
      })
    }
  }, [user, mounted])

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const handleEditProfile = async (e) => {
    e.preventDefault()
    if (!form.full_name || !form.email) {
      toast.error('Name and Email are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update profile')
      }
      const data = await res.json()
      setUser(data.user)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success('Profile updated successfully!')
      setEditOpen(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const joinDate = user.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'July 2026'

  const userInitials = (user.full_name || user.email || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-12">
      {/* Top Section / User Card */}
      <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-soft overflow-hidden radius-xl mb-8 slide-up">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center font-display font-extrabold text-2xl text-primary shadow-soft shrink-0">
              {userInitials}
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-extrabold text-foreground">{user.full_name || 'Business Partner'}</h1>
              <p className="text-sm text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">{user.role || 'Customer'} Account</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {joinDate}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => setEditOpen(true)} 
              variant="outline" 
              className="rounded-full flex items-center gap-2 h-10 px-5 shadow-sm"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </Button>
            <Button 
              onClick={logout} 
              variant="destructive" 
              className="rounded-full flex items-center gap-2 h-10 px-5 shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Block */}
      <div className="grid md:grid-cols-2 gap-6 mb-8 slide-up" style={{ transitionDelay: '50ms' }}>
        <Card className="border border-border/40 bg-card/40 radius-lg">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact & Company</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email Address</p>
                  <p className="font-medium text-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone Number</p>
                  <p className="font-medium text-foreground">{user.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Company Name</p>
                  <p className="font-medium text-foreground">{user.company_name || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border/40 bg-card/40 radius-lg">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">B2B & Address Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">GST Identification (GSTIN)</p>
                <p className="font-medium text-foreground mt-0.5">
                  {user.gst_number ? (
                    <span className="text-emerald-600 font-bold">{user.gst_number} (Registered)</span>
                  ) : (
                    <span className="text-muted-foreground italic">Not registered</span>
                  )}
                </p>
              </div>
              <div className="border-t border-border/30 pt-2">
                <p className="text-xs text-muted-foreground">Billing/Shipping Address</p>
                {user.address ? (
                  <div className="font-medium text-foreground mt-1 space-y-0.5">
                    <p>{user.address}</p>
                    <p>{[user.city, user.state].filter(Boolean).join(', ')}{user.pincode ? ` - ${user.pincode}` : ''}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic mt-1">Address not provided</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Quick Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 slide-up" style={{ transitionDelay: '100ms' }}>
        {[
          { name: 'My Orders', icon: ShoppingBag, desc: 'Track, return, or buy again', path: '/orders' },
          { name: 'Addresses', icon: MapPin, desc: 'Manage shipping locations', path: '/account/addresses' },
          { name: 'Wishlist', icon: Heart, desc: 'Your saved items', path: '/wishlist' },
          { name: 'Help Center', icon: HelpCircle, desc: 'Contact customer support', path: '/contact' }
        ].map((tile, i) => {
          const Icon = tile.icon
          return (
            <Link 
              key={i} 
              href={tile.path}
              className="group flex flex-col justify-between p-5 bg-card border border-border/50 hover:border-accent/40 rounded-2xl hover:shadow-soft transition-all duration-300 text-left h-44"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/60 group-hover:bg-primary flex items-center justify-center transition-colors">
                <Icon className="w-6 h-6 text-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-foreground group-hover:text-primary transition-colors">{tile.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{tile.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Edit Profile Modal / Overlay */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 fade-in">
          <Card 
            className="w-full max-w-lg bg-card border shadow-dramatic radius-xl scale-in"
            onClick={e => e.stopPropagation()}
          >
            <CardContent className="pt-6">
              <h3 className="font-display font-extrabold text-xl mb-4">Edit Profile</h3>
              <form onSubmit={handleEditProfile} className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto px-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input 
                        id="full_name"
                        value={form.full_name} 
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} 
                        placeholder="Enter your name" 
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email"
                        type="email"
                        value={form.email} 
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                        placeholder="Enter your email" 
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone"
                        value={form.phone} 
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                        placeholder="Enter phone number" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input 
                        id="company_name"
                        value={form.company_name} 
                        onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} 
                        placeholder="Enter company name" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gst_number">GST Number (optional)</Label>
                    <Input 
                      id="gst_number"
                      value={form.gst_number} 
                      onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} 
                      placeholder="Enter 15-digit GST number" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input 
                      id="address"
                      value={form.address} 
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))} 
                      placeholder="Enter street address" 
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input 
                        id="city"
                        value={form.city} 
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))} 
                        placeholder="City" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">State</Label>
                      <Input 
                        id="state"
                        value={form.state} 
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))} 
                        placeholder="State" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input 
                        id="pincode"
                        value={form.pincode} 
                        onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} 
                        placeholder="6 digits" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditOpen(false)} 
                    className="flex-1 rounded-full"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-full" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Save Changes
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
