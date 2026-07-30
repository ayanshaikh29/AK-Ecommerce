'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Truck, Plus, RefreshCw, UserCheck, Mail, Phone, Lock, Trash2, Key, Copy, MessageCircle, CheckCircle2, Check, ExternalLink, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export function VendorManager() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Credentials Modal State
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [copied, setCopied] = useState(false)

  // Delete Account State
  const [deleteDialogUser, setDeleteDialogUser] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Profile View State
  const [profileUserId, setProfileUserId] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const fetchVendors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/vendors', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setVendors(data || [])
      } else {
        toast.error('Failed to load vendor list')
      }
    } catch {
      toast.error('Error fetching vendors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  // Delete Account Handler
  const handleDeleteVendor = async (v) => {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ user_id: v.user_id || v.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete account')
      toast.success('Vendor account deleted successfully')
      setDeleteDialogUser(null)
      fetchVendors()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleVendorStatus = async (v) => {
    try {
      const res = await fetch('/api/admin/vendors', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ id: v.id, is_enabled: !v.is_enabled })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }
      toast.success(`Vendor ${v.is_enabled ? 'disabled' : 'enabled'} successfully`)
      fetchVendors()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleViewProfile = async (userId) => {
    setProfileUserId(userId)
    setProfileLoading(true)
    setProfileData(null)
    try {
      const res = await fetch(`/api/admin/user-profile?user_id=${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to load profile')
      }
      const data = await res.json()
      setProfileData(data)
    } catch (err) {
      toast.error(err.message)
      setProfileUserId(null)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) {
      toast.error('Vendor Name, Email, and Password are required')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: 'vendor', full_name: name, email, password, phone })
      })
      if (res.ok) {
        const data = await res.json()
        toast.success('Vendor partner created successfully!')
        setName('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setPhone('')
        setDialogOpen(false)
        setCreatedCredentials(data.user)
        fetchVendors()
      } else {
        const err = await res.json()
        toast.error(err.error || err.message || 'Failed to create vendor partner')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-accent" /> Vendor & Delivery Partners
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage fulfillment vendor logins and logistics partner accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchVendors} className="rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gold-gradient text-primary font-bold shadow-soft">
                <Plus className="w-4 h-4 mr-1.5" /> Create Vendor Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display font-extrabold text-xl text-foreground flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-accent" /> Register Vendor Partner Account
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Vendor Company / Partner Name *</label>
                  <Input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. BlueDart Express or Swift Delivery"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block">Login Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vendor@logistics.com"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block">Contact Phone (WhatsApp)</label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Vendor Access Password *</label>
                  <PasswordInput
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="h-10 rounded-xl"
                  />
                  {password && password.length < 8 && (
                    <p className="text-[11px] text-red-500 mt-1">Password must be at least 8 characters</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Confirm Password *</label>
                  <PasswordInput
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="h-10 rounded-xl"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-full gold-gradient text-primary font-bold text-xs mt-2">
                  {submitting ? 'Registering...' : 'Create Vendor Partner Account'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Vendors Table / List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">Loading vendor partners...</div>
      ) : vendors.length === 0 ? (
        <Card className="radius-xl shadow-soft text-center py-12">
          <CardContent>
            <Truck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-foreground">No Vendor Partners Registered</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Create Vendor Partner" to register a logistics fulfillment account.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map(v => (
            <Card key={v.id} className="radius-xl shadow-soft border border-border p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-accent" /> {v.name}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold mt-1">
                      Vendor Partner
                    </Badge>
                    {v.is_enabled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full font-bold mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span> Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-accent" />
                  <span className="font-mono text-foreground font-semibold">{v.email}</span>
                </div>
                {v.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-accent" />
                    <span>{v.phone}</span>
                  </div>
                )}
                <div className="pt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewProfile(v.user_id || v.id)}
                    className="flex-1 rounded-xl h-8 text-xs font-bold text-blue-600 border-blue-300 hover:bg-blue-50"
                    title="View Profile"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Profile
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const autoPw = 'VND' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!'
                      try {
                        const res = await fetch('/api/admin/reset-password', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`
                          },
                          body: JSON.stringify({ email: v.email, new_password: autoPw })
                        })
                        if (!res.ok) throw new Error('Failed to generate vendor credentials')
                        const data = await res.json()
                        setCreatedCredentials({ ...data.user, full_name: v.name || data.user.full_name, role: 'vendor' })
                        toast.success('Vendor credentials ready to copy/share!')
                      } catch (err) {
                        toast.error(err.message)
                      }
                    }}
                    className="flex-1 rounded-xl h-8 text-xs font-bold text-accent border-accent/30 hover:bg-accent/10"
                  >
                    <Key className="w-3.5 h-3.5 mr-1" /> Credentials
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteDialogUser(v)}
                    className="rounded-xl h-8 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10 px-2"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant={v.is_enabled ? "destructive" : "default"}
                    onClick={() => handleToggleVendorStatus(v)}
                    className="w-full rounded-xl h-8 text-xs font-bold"
                  >
                    {v.is_enabled ? "Disable Partner" : "Enable Partner"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Created Vendor Credentials Modal */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-md radius-xl p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Vendor Account Created
            </DialogTitle>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 mt-2">
              <p className="text-xs text-muted-foreground">
                Share these vendor portal login credentials with <strong>{createdCredentials.full_name}</strong>:
              </p>

              <div className="bg-secondary/40 p-4 rounded-2xl border space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Vendor Name</span>
                  <span className="font-bold text-foreground">{createdCredentials.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Vendor Portal URL</span>
                  <span className="font-mono font-bold text-accent">{typeof window !== 'undefined' ? `${window.location.origin}/vendor/login` : '/vendor/login'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Email Address</span>
                  <span className="font-mono font-bold text-foreground">{createdCredentials.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Temporary Password</span>
                  <span className="font-mono font-bold text-accent">{createdCredentials.temporary_password}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => {
                    const text = `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Vendor Fulfillment Portal Account has been created!\n\nVendor Portal Login: ${window.location.origin}/vendor/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to access assigned delivery orders and warehouse stock inventory.`
                    navigator.clipboard.writeText(text)
                    setCopied(true)
                    toast.success('Vendor credentials copied to clipboard!')
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  variant="outline"
                  className="rounded-xl h-11 text-xs font-bold"
                >
                  {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copied ? 'Copied!' : 'Copy Credentials'}
                </Button>

                <Button
                  onClick={() => {
                    const text = `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Vendor Fulfillment Portal Account has been created!\n\nVendor Portal Login: ${window.location.origin}/vendor/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to access assigned delivery orders and warehouse stock inventory.`
                    const phone = createdCredentials.phone?.replace(/[^0-9]/g, '')
                    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
                    window.open(url, '_blank')
                  }}
                  className="rounded-xl h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Share WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={!!deleteDialogUser} onOpenChange={() => setDeleteDialogUser(null)}>
        <DialogContent className="max-w-sm radius-xl p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Vendor Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{deleteDialogUser?.name || deleteDialogUser?.full_name}</strong>'s vendor account ({deleteDialogUser?.email})? This action cannot be undone.
            </p>
            <p className="text-[11px] text-destructive font-semibold">All associated data will be removed. Orders assigned to this vendor will be preserved.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteDialogUser(null)} className="rounded-xl h-10 text-xs font-bold flex-1">Cancel</Button>
              <Button onClick={() => handleDeleteVendor(deleteDialogUser)} disabled={deleting} className="rounded-xl h-10 text-xs font-bold bg-destructive hover:bg-destructive/90 text-white flex-1">
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Slide-Over Panel */}
      {profileUserId && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProfileUserId(null)} />
          <div className="relative w-full max-w-lg bg-card border-l shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-card border-b px-6 py-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Vendor Profile</h2>
              <button onClick={() => setProfileUserId(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {profileLoading ? (
                <div className="py-16 text-center text-xs text-muted-foreground">Loading profile...</div>
              ) : profileData ? (
                <>
                  {/* Basic Info */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Basic Information</h3>
                    <div className="bg-secondary/40 p-4 rounded-2xl border space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-bold">{profileData.user.full_name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-mono">{profileData.user.email}</span></div>
                      {profileData.user.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono">{profileData.user.phone}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-bold capitalize">{profileData.user.role}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-bold ${profileData.user.status === 'active' ? 'text-emerald-600' : 'text-destructive'}`}>{profileData.user.status || 'active'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span>{profileData.user.created_at ? new Date(profileData.user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Last Login</span><span>{profileData.user.last_login_at ? new Date(profileData.user.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
                    </div>
                  </div>

                  {/* Order Statistics */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Order Statistics</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                        <p className="text-2xl font-extrabold text-foreground">{profileData.orderStats.totalOrders}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Orders</p>
                      </div>
                      <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                        <p className="text-2xl font-extrabold text-accent">{formatINR(profileData.orderStats.totalSpent)}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Lifetime Value</p>
                      </div>
                      <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                        <p className="text-2xl font-extrabold text-foreground">{formatINR(profileData.orderStats.avgOrderValue)}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Avg Order Value</p>
                      </div>
                      <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                        <p className="text-2xl font-extrabold text-foreground">{Object.keys(profileData.orderStats.statusBreakdown).length}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Status Types</p>
                      </div>
                    </div>
                    {Object.keys(profileData.orderStats.statusBreakdown).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(profileData.orderStats.statusBreakdown).map(([status, count]) => (
                          <Badge key={status} variant="outline" className="text-[10px] font-bold capitalize">{status}: {count}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fulfillment Stats */}
                  {profileData.vendorStats && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Fulfillment Performance</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                          <p className="text-lg font-extrabold text-emerald-600">{profileData.vendorStats.totalFulfilled}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">Delivered</p>
                        </div>
                        <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                          <p className="text-lg font-extrabold text-amber-600">{profileData.vendorStats.currentlyAssigned}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">In Progress</p>
                        </div>
                        <div className="bg-secondary/40 p-3 rounded-xl border text-center">
                          <p className="text-lg font-extrabold text-foreground">{profileData.vendorStats.totalAssigned}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">Total</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order History */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Order History ({profileData.orders.length})</h3>
                    {profileData.orders.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No orders yet</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {profileData.orders.map(o => (
                          <a key={o.id} href={`/admin/orders?highlight=${o.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border hover:bg-secondary/60 transition text-xs">
                            <div>
                              <p className="font-bold text-foreground">{o.order_number || o.id.slice(0, 8)}</p>
                              <p className="text-[10px] text-muted-foreground">{o.placed_at ? new Date(o.placed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} • {o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-foreground">{formatINR(o.total)}</p>
                              <Badge variant="outline" className={`text-[9px] capitalize font-bold ${o.status === 'delivered' ? 'text-emerald-600 border-emerald-300' : o.status === 'cancelled' ? 'text-destructive border-destructive/30' : 'text-amber-600 border-amber-300'}`}>{o.status}</Badge>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
