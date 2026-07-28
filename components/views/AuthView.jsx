'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/components/providers/AppProvider'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'

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

export function AuthView({ mode }) {
  const { setUser } = useAppContext()
  const router = useRouter()
  
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  
  const submit = async e => { 
    e.preventDefault()
    setLoading(true)
    try { 
      const res = await fetch('/api/auth/' + mode, { 
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
      document.cookie = `user_role=${data.user.role}; path=/; max-age=31536000`
      setUser(data.user)
      
      toast.success(mode === 'login' ? 'Welcome back' : 'Account created')
      if (data.user.role === 'admin') {
        window.location.href = '/admin'
      } else if (data.user.role === 'vendor') {
        window.location.href = '/vendor'
      } else {
        window.location.href = '/products'
      }
    } catch (e) { 
      toast.error(e.message) 
    } finally { 
      setLoading(false) 
    } 
  }
  
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md radius-xl shadow-elevated slide-up">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 gold-gradient rounded-2xl font-display font-extrabold text-primary text-2xl mb-4 pulse-glow shadow-soft">AK</div>
            <h1 className="font-display text-3xl font-extrabold">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p className="text-muted-foreground text-sm mt-1">{mode === 'login' ? 'Sign in to continue' : 'Join AK Enterprises'}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label>Full name</Label>
                <Input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="h-11 rounded-xl"/>
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-11 rounded-xl"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Password</Label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => router.push('/forgot-password')} 
                    className="text-xs text-accent font-semibold hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="h-11 rounded-xl"/>
            </div>
            {mode === 'signup' && (
              <div>
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-11 rounded-xl"/>
              </div>
            )}

            <Button type="submit" disabled={loading} onClick={addRipple} className="w-full h-12 rounded-full btn-shine ripple font-semibold" size="lg">
              {loading ? <span className="btn-spinner"/> : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/70" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-card px-3 text-muted-foreground font-extrabold tracking-wider">
                Or Continue With
              </span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <GoogleSignInButton text={mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'} />
          <p className="text-sm text-center text-muted-foreground mt-6">
            {mode === 'login' ? (
              <>New here? <button onClick={() => router.push('/signup')} className="text-accent font-bold hover:underline">Create account</button></>
            ) : (
              <>Already have an account? <button onClick={() => router.push('/login')} className="text-accent font-bold hover:underline">Sign in</button></>
            )}
          </p>
          {mode === 'login' && <div className="mt-6 p-3 bg-secondary rounded-xl text-xs"><b>Admin demo:</b> admin@store.com / Admin@123</div>}
        </CardContent>
      </Card>
    </div>
  )
}
