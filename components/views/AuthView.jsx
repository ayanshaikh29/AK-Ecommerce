'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/components/providers/AppProvider'

function addRipple(e) {
  const btn = e.currentTarget; if (!btn) return
  const rect = btn.getBoundingClientRect()
  const r = document.createElement('span')
  const size = Math.max(rect.width, rect.height)
  r.className = 'ripple-el'
  r.style.width = r.style.height = size + 'px'
  r.style.left = (e.clientX - rect.left - size / 2) + 'px'
  r.style.top = (e.clientY - rect.top - size / 2) + 'px'
  btn.appendChild(r)
  setTimeout(() => r.remove(), 600)
}

export function AuthView({ mode = 'login' }) {
  const { setUser } = useAppContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const isSignupDisabled = mode === 'signup' || searchParams.get('notice') === 'signup_disabled'

  useEffect(() => {
    if (searchParams.get('notice') === 'signup_disabled') {
      toast.info('Self-registration is disabled. Please log in with your credentials.')
    }
  }, [searchParams])

  const submit = async e => { 
    e.preventDefault()
    setLoading(true)
    try { 
      const res = await fetch('/api/auth/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form) 
      })
      
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || errData.message || 'Authentication failed')
      }
      
      const data = await res.json()
      
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      document.cookie = `auth_token=${data.token}; path=/; max-age=31536000`
      document.cookie = `user_role=${data.user.role}; path=/; max-age=31536000`
      setUser(data.user)
      
      toast.success('Welcome back!')
      if (data.user.role === 'admin') {
        window.location.href = '/admin'
      } else if (data.user.role === 'vendor') {
        window.location.href = '/vendor'
      } else {
        window.location.href = '/customer/dashboard'
      }
    } catch (e) { 
      toast.error(e.message) 
    } finally { 
      setLoading(false) 
    } 
  }

  if (mode === 'signup') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md radius-xl shadow-elevated text-center p-8">
          <Info className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="font-display text-2xl font-extrabold text-foreground mb-2">Public Signup Disabled</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            Account registration is managed exclusively by AK Enterprises Owner. Please log in using the credentials provided to you.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full rounded-full h-11 font-semibold gold-gradient text-primary">
            Proceed to Login
          </Button>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md radius-xl shadow-elevated slide-up">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 gold-gradient rounded-2xl font-display font-extrabold text-primary text-2xl mb-4 pulse-glow shadow-soft">AK</div>
            <h1 className="font-display text-3xl font-extrabold">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your AK Enterprises account</p>
          </div>

          {isSignupDisabled && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 text-left">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
              <span><strong>Notice:</strong> Self-registration is disabled. Log in with credentials issued by Owner.</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4 text-left">
            <div>
              <Label>Email Address</Label>
              <Input required type="email" placeholder="name@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-11 rounded-xl"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Password</Label>
                <button 
                  type="button" 
                  onClick={() => router.push('/forgot-password')} 
                  className="text-xs text-accent font-semibold hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput required placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="h-11 rounded-xl"/>
            </div>

            <Button type="submit" disabled={loading} onClick={addRipple} className="w-full h-12 rounded-full gold-gradient text-primary font-bold shadow-soft ripple font-semibold" size="lg">
              {loading ? <span className="btn-spinner"/> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 p-3.5 bg-secondary/60 rounded-xl text-xs text-muted-foreground text-center">
            Zonal Admin? <button onClick={() => router.push('/vendor/login')} className="text-accent font-bold hover:underline">Zonal Admin Portal Login</button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
