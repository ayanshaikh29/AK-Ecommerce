'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/PasswordInput'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Extract email or token from query parameters or window location hash
    const queryEmail = searchParams?.get('email')
    if (queryEmail) setEmail(queryEmail)

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')
      if (type === 'recovery' && accessToken) {
        // Token received from Supabase Auth reset link
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!success) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [success, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters long.'
      setErrorMsg(msg)
      toast.error(msg)
      return
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match. Please verify.'
      setErrorMsg(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          email: email.trim().toLowerCase() || undefined
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        toast.success('Password updated successfully!')
      } else {
        setErrorMsg(data.error || 'Password reset failed')
        toast.error(data.error || 'Password reset failed')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred')
      toast.error(err.message || 'Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md radius-xl shadow-elevated slide-up border border-border">
      <CardContent className="p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 gold-gradient rounded-2xl font-display font-extrabold text-primary text-2xl mb-4 pulse-glow shadow-soft">
            AK
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">Set New Password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Choose a strong password for your account
          </p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-left flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-foreground text-sm">Password Reset Successful</p>
                <p className="text-muted-foreground leading-relaxed">
                  Your password has been updated securely. Redirecting to login in <strong className="text-accent">{countdown}s</strong>...
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button className="w-full h-12 rounded-full gold-gradient text-primary font-bold text-sm shadow-glow flex items-center justify-center gap-2">
                  Go to Login <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!searchParams?.get('email') && (
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-2 block">
                  Account Email Address
                </Label>
                <input
                  required
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-2 block">
                New Password
              </Label>
              <PasswordInput
                required
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Must be at least 8 characters long.</p>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-2 block">
                Confirm New Password
              </Label>
              <PasswordInput
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full gold-gradient text-primary font-bold text-sm shadow-glow"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                </span>
              ) : (
                'Update Password'
              )}
            </Button>

            <div className="pt-2 text-center">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-accent font-medium">
                Need a new reset link? <span className="underline font-bold">Request link</span>
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
