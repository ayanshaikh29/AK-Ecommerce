'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Mail, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })

      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
        setMessage(data.message || 'If an account exists with this email, a password reset link has been sent.')
        toast.success('Reset request submitted')
      } else {
        toast.error(data.error || 'Failed to process request')
      }
    } catch (err) {
      toast.error(err.message || 'Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md radius-xl shadow-elevated slide-up border border-border">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 gold-gradient rounded-2xl font-display font-extrabold text-primary text-2xl mb-4 pulse-glow shadow-soft">
              AK
            </div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">Forgot Password</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Enter your corporate email to receive a password reset link
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-left flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-foreground text-sm">Request Processed</p>
                  <p className="text-muted-foreground leading-relaxed">
                    {message}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 pt-1">
                    Check your inbox and spam folder for instructions.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/login">
                  <Button className="w-full h-12 rounded-full gold-gradient text-primary font-bold text-sm shadow-glow">
                    Return to Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-2 block">
                  Registered Email Address
                </Label>
                <div className="relative">
                  <Input
                    required
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl pl-10 text-sm"
                  />
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                onClick={addRipple}
                className="w-full h-12 rounded-full gold-gradient text-primary font-bold text-sm shadow-glow"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <div className="pt-4 text-center">
                <Link href="/login" className="inline-flex items-center text-xs text-accent font-bold hover:underline gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
