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
  const [copiedPass, setCopiedPass] = useState(false)

  // Change Password Modal States
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [changePwLoading, setChangePwLoading] = useState(false)
  const [changePwForm, setChangePwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', forceLogout: false })

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
        toast.error('Failed to load zonal admin list')
      }
    } catch {
      toast.error('Error fetching zonal admins')
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
      toast.success('Zonal Admin account deleted successfully')
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
      toast.success(`Zonal Admin ${v.is_enabled ? 'disabled' : 'enabled'} successfully`)
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
      toast.error('Zonal Admin Name, Email, and Password are required')
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
        toast.success('Zonal Admin created successfully!')
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
        toast.error(err.error || err.message || 'Failed to create Zonal Admin')
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
            <Truck className="w-6 h-6 text-accent" /> Zonal Admins
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage zonal admin logins and regional coordinator accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchVendors} className="rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gold-gradient text-primary font-bold shadow-soft">
                <Plus className="w-4 h-4 mr-1.5" /> Create Zonal Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display font-extrabold text-xl text-foreground flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-accent" /> Register Zonal Admin Account
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Zonal Admin Name *</label>
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
                    placeholder="zonaladmin@akenterprises.com"
                    className="h-10 rounded-xl"
                    autoComplete="new-password"
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
                  <label className="text-xs font-semibold block mb-1">Zonal Admin Access Password *</label>
                  <PasswordInput
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="h-10 rounded-xl"
                    autoComplete="new-password"
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
                    autoComplete="new-password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-full gold-gradient text-primary font-bold text-xs mt-2">
                  {submitting ? 'Registering...' : 'Create Zonal Admin Account'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Vendors Table / List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">Loading Zonal Admins...</div>
      ) : vendors.length === 0 ? (
        <Card className="radius-xl shadow-soft text-center py-12">
          <CardContent>
            <Truck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-foreground">No Zonal Admins Registered</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Create Zonal Admin" to register a zonal admin account.</p>
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
                      Zonal Admin
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
                      try {
                        const res = await fetch(`/api/admin/user-credentials?user_id=${v.user_id || v.id}`, {
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                        })
                        if (!res.ok) throw new Error('Failed to retrieve zonal admin credentials')
                        const data = await res.json()
                        setCreatedCredentials({
                          id: data.id,
                          full_name: data.full_name,
                          email: data.email,
                          phone: data.phone,
                          role: 'vendor',
                          temporary_password: data.plain_password || 'No password assigned',
                          updated_at: data.updated_at
                        })
                        toast.success('Zonal Admin credentials ready to manage!')
                      } catch (err) {
                        toast.error(err.message)
                      }
                    }}
                    className="flex-1 rounded-xl h-8 text-xs font-bold text-accent border-accent/30 hover:bg-accent/10"
                    title="View Credentials"
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

      {/* Created Zonal Admin Credentials Modal */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-md radius-xl p-6 text-left bg-white/90 backdrop-blur-md border border-[#ECECEC] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl flex items-center gap-2 text-slate-800">
              <CheckCircle2 className="w-6 h-6 text-[#F4B942] animate-bounce" /> Zonal Admin Account Managed
            </DialogTitle>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-5 mt-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Managed zonal admin profile credentials and logistics access configs:
              </p>

              <div className="bg-[#F8F9FC] p-5 rounded-2xl border border-slate-100 space-y-3.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Zonal Admin Name</span>
                  <span className="font-bold text-slate-800">{createdCredentials.full_name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Zonal Admin Portal URL</span>
                  <span className="font-mono font-bold text-[#F4B942] max-w-[200px] truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/vendor/login` : '/vendor/login'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Email Address</span>
                  <span className="font-mono font-bold text-slate-800">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Password</span>
                  <span className="font-mono font-bold text-slate-800">{createdCredentials.temporary_password}</span>
                </div>
                {createdCredentials.phone && (
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Phone Number</span>
                    <span className="font-mono font-bold text-slate-800">{createdCredentials.phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Last Changed</span>
                  <span className="font-semibold text-slate-500 text-[10px]">
                    {createdCredentials.updated_at ? new Date(createdCredentials.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just Now'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => {
                      const loginUrl = `${window.location.origin}/vendor/login`
                      const text = `AK Enterprises B2B Portal\n\nLogin URL: ${loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\nPhone: ${createdCredentials.phone || 'N/A'}`
                      navigator.clipboard.writeText(text)
                      setCopied(true)
                      toast.success('Zonal admin credentials copied!')
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    variant="outline"
                    className="rounded-full h-11 text-xs font-bold border-slate-200 hover:bg-slate-50"
                  >
                    {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5 text-slate-500" />}
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </Button>

                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.temporary_password)
                      setCopiedPass(true)
                      toast.success('Zonal admin password copied!')
                      setTimeout(() => setCopiedPass(false), 2000)
                    }}
                    variant="outline"
                    className="rounded-full h-11 text-xs font-bold border-slate-200 hover:bg-slate-50"
                  >
                    {copiedPass ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Lock className="w-4 h-4 mr-1.5 text-slate-500" />}
                    {copiedPass ? 'Password Copied!' : 'Copy Password'}
                  </Button>
                </div>

                <Button
                  onClick={() => {
                    const loginUrl = `${window.location.origin}/vendor/login`
                    const text = `*AK Enterprises B2B Portal*\n\nYour zonal admin portal account credentials have been updated.\n\n*Login URL:* ${loginUrl}\n*Email:* ${createdCredentials.email}\n*Password:* ${createdCredentials.temporary_password}\n\n_Support details: Please contact owner for customized pricing or warehouse support issues._`
                    const phone = createdCredentials.phone?.replace(/[^0-9]/g, '')
                    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
                    window.open(url, '_blank')
                  }}
                  className="rounded-full h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Share WhatsApp
                </Button>

                <Button
                  onClick={() => {
                    setChangePwForm({ currentPassword: '', newPassword: '', confirmPassword: '', forceLogout: false })
                    setChangePwOpen(true)
                  }}
                  className="rounded-full h-11 text-xs font-bold bg-[#F4B942] text-primary hover:bg-[#e0a634] shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Key className="w-4 h-4" /> Change Password
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePwOpen} onOpenChange={setChangePwOpen}>
        <DialogContent className="max-w-md radius-xl p-6 text-left bg-white border border-[#ECECEC] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-lg flex items-center gap-2 text-slate-800">
              <Lock className="w-5 h-5 text-[#F4B942]" /> Change Zonal Admin Password
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!changePwForm.newPassword) {
                toast.error('New Password is required')
                return
              }
              if (changePwForm.newPassword.length < 8) {
                toast.error('New password must be at least 8 characters')
                return
              }
              if (changePwForm.newPassword !== changePwForm.confirmPassword) {
                toast.error('New passwords do not match')
                return
              }

              setChangePwLoading(true)
              try {
                const res = await fetch('/api/admin/reset-password', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({
                    user_id: createdCredentials.id,
                    email: createdCredentials.email,
                    new_password: changePwForm.newPassword
                  })
                })

                if (!res.ok) {
                  const errData = await res.json()
                  throw new Error(errData.error || errData.message || 'Failed to update zonal admin password')
                }

                setCreatedCredentials({
                  ...createdCredentials,
                  temporary_password: changePwForm.newPassword,
                  updated_at: new Date().toISOString()
                })
                toast.success('Zonal Admin password updated successfully!')
                setChangePwOpen(false)
                fetchVendors()
              } catch (err) {
                toast.error(err.message)
              } finally {
                setChangePwLoading(false)
              }
            }}
            className="space-y-4 pt-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Current Password (optional)</label>
              <PasswordInput
                placeholder="Enter current password if known"
                value={changePwForm.currentPassword}
                onChange={e => setChangePwForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">New Password *</label>
              <PasswordInput
                required
                placeholder="Min 8 characters"
                value={changePwForm.newPassword}
                onChange={e => setChangePwForm(prev => ({ ...prev, newPassword: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Confirm New Password *</label>
              <PasswordInput
                required
                placeholder="Re-enter new password"
                value={changePwForm.confirmPassword}
                onChange={e => setChangePwForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="forceLogoutBoxVendor"
                checked={changePwForm.forceLogout}
                onChange={e => setChangePwForm(prev => ({ ...prev, forceLogout: e.target.checked }))}
                className="w-4 h-4 rounded text-[#F4B942] focus:ring-[#F4B942] border-slate-300"
              />
              <label htmlFor="forceLogoutBoxVendor" className="font-bold text-slate-600 select-none cursor-pointer">
                Force partner to login again
              </label>
            </div>

            <div className="flex gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePwOpen(false)}
                className="rounded-full h-11 text-xs font-bold flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={changePwLoading}
                className="rounded-full h-11 text-xs font-bold bg-[#F4B942] text-primary hover:bg-[#e0a634] flex-1"
              >
                {changePwLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={!!deleteDialogUser} onOpenChange={() => setDeleteDialogUser(null)}>
        <DialogContent className="max-w-sm radius-xl p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Zonal Admin Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{deleteDialogUser?.name || deleteDialogUser?.full_name}</strong>'s zonal admin account ({deleteDialogUser?.email})? This action cannot be undone.
            </p>
            <p className="text-[11px] text-destructive font-semibold">All associated data will be removed. Orders assigned to this zonal admin will be preserved.</p>
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
              <h2 className="font-display font-bold text-lg">Zonal Admin Profile</h2>
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
