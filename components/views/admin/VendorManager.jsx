'use client'
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Truck, Plus, RefreshCw, UserCheck, Mail, Phone, Lock, Trash2, Key } from 'lucide-react'
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
  const [vehicle, setVehicle] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      const res = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, email, password, phone, vehicle_info: vehicle })
      })
      if (res.ok) {
        toast.success('Vendor partner created successfully!')
        setName('')
        setEmail('')
        setPassword('')
        setPhone('')
        setVehicle('')
        setDialogOpen(false)
        fetchVendors()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to create vendor')
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
                  <label className="text-xs font-semibold mb-1 block">Vendor Company / Driver Name *</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="FastExpress Freight Services"
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block">Vendor Login Email *</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vendor@fastexpress.com"
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block">Login Password *</label>
                  <PasswordInput
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Contact Phone</label>
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Vehicle / Region</label>
                    <Input
                      value={vehicle}
                      onChange={e => setVehicle(e.target.value)}
                      placeholder="MH-12 Truck / Pune"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl gold-gradient text-primary font-bold shadow-soft"
                >
                  {submitting ? 'Creating Account...' : 'Create Vendor Account'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Vendors Table / Grid */}
      <Card className="radius-lg shadow-soft overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">Loading vendor accounts...</div>
          ) : vendors.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No vendor accounts registered yet. Click "Create Vendor Partner" to register one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Vendor Partner Name</th>
                    <th className="py-3 px-4">Login Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Vehicle / Region</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendors.map(v => (
                    <tr key={v.id} className="hover:bg-secondary/30 transition">
                      <td className="py-3 px-4 font-bold text-foreground flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center text-xs">
                          {v.name ? v.name.charAt(0).toUpperCase() : 'V'}
                        </div>
                        {v.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{v.email}</td>
                      <td className="py-3 px-4 text-muted-foreground">{v.phone || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{v.vehicle_info || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge className="bg-blue-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                          VENDOR
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">{v.assigned_orders_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
