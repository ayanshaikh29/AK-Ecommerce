'use client'
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Truck, Plus, RefreshCw, UserCheck, Mail, Phone, Lock, Trash2, Key, Copy, MessageCircle, CheckCircle2, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export function VendorManager() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Credentials Modal State
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [copied, setCopied] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) {
      toast.error('Vendor Name, Email, and Password are required')
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold block">Vendor Access Password *</label>
                    <button
                      type="button"
                      onClick={() => setPassword('VND' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!')}
                      className="text-[11px] text-accent font-bold hover:underline"
                    >
                      ⚡ Auto-Generate
                    </button>
                  </div>
                  <PasswordInput
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 rounded-xl"
                  />
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
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold mt-1">
                    Vendor Partner
                  </Badge>
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
                <div className="pt-2">
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
                    className="w-full rounded-xl h-8 text-xs font-bold text-accent border-accent/30 hover:bg-accent/10"
                  >
                    <Key className="w-3.5 h-3.5 mr-1.5" /> Copy / Share Credentials
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
    </div>
  )
}
