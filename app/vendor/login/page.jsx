'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ShieldCheck, LogIn } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/components/providers/AppProvider'

export default function VendorLoginPage() {
  const { setUser } = useAppContext()
  const router = useRouter()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || 'Vendor login failed')
      }

      const data = await res.json()

      if (data.user.role !== 'vendor' && data.user.role !== 'admin') {
        toast.error('Access Denied: This portal is reserved for Vendor Logistics Partners.')
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      // IMPORTANT: Both cookies must be set — middleware checks auth_token for session validity
      document.cookie = `auth_token=${data.token}; path=/; max-age=31536000`
      document.cookie = `user_role=${data.user.role}; path=/; max-age=31536000`
      setUser(data.user)

      toast.success(`Welcome back, ${data.user.full_name || 'Zonal Admin'}`)
      router.push('/vendor')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 text-left">
      <Card className="w-full max-w-md radius-xl shadow-elevated slide-up border border-border">
        <CardContent className="p-8">
          {/* Circular Gold Icon Header matching Customer Login Style */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 gold-gradient rounded-2xl font-display font-extrabold text-primary text-2xl mb-4 pulse-glow shadow-soft">
              <Truck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">Vendor Fulfillment Portal</h1>
            <p className="text-accent font-semibold text-xs mt-1">AK Enterprises — Logistics Partner Portal</p>
          </div>

          <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
            <span>Authorized delivery & stock inventory access only.</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Vendor Account Email</Label>
              <Input
                required
                type="email"
                placeholder="vendor@logistics.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-bold mb-1.5 block">Access Password</Label>
              <PasswordInput
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full gold-gradient text-primary font-bold text-sm shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="btn-spinner" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In to Vendor Portal
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
            Need credentials? Contact your AK Enterprises Account Administrator.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
