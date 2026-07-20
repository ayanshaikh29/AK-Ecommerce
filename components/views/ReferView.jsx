'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gift, Copy, Share2, Users, Award, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '@/components/providers/AppProvider'

export function ReferView() {
  const { user } = useAppContext()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadStats = async () => {
    if (!user) { setLoading(false); return }
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/referral/stats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [user])

  const getRefLink = () => {
    if (!stats?.referral_code) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/signup?ref=${stats.referral_code}`
  }

  const copyLink = () => {
    const link = getRefLink()
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Referral link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const getWhatsAppShare = () => {
    const link = getRefLink()
    const text = `Partner with AK Enterprises for premium B2B office stationery, housekeeping supplies & UPS systems! Sign up using my referral link to get ₹50 off your first order:\n\n${link}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading referral details...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 slide-up">
        <Card className="radius-xl shadow-elevated border overflow-hidden">
          <div className="bg-primary text-primary-foreground p-8 text-center relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-accent/20 rounded-full blur-2xl" />
            <Gift className="w-16 h-16 text-accent mx-auto mb-4 animate-bounce" />
            <h1 className="font-display text-3xl font-extrabold mb-2">AK Refer & Earn</h1>
            <p className="text-primary-foreground/80 max-w-md mx-auto text-sm">Introduce businesses and friends to AK Enterprises. Both of you receive a ₹50 discount coupon on signup!</p>
          </div>
          <CardContent className="p-8 text-center space-y-6">
            <h2 className="font-bold text-lg">Sign in to claim your referral code</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Generate your unique referral link to start sharing via WhatsApp, Email, or Slack and track your rewards in real-time.</p>
            <div className="flex justify-center gap-4">
              <Link href="/login">
                <Button className="rounded-full px-8 h-11">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline" className="rounded-full px-8 h-11 border-primary text-primary hover:bg-primary/5">Create Account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 slide-up">
      <div className="text-center mb-10">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3 block">— Share the love</span>
        <h1 className="font-display text-4xl font-extrabold text-foreground mb-4">Refer & Earn Rewards</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">Gift ₹50 to your partners on signup, and receive ₹50 off your own next order when they join.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Referral Card */}
        <Card className="md:col-span-2 radius-xl shadow-soft border">
          <CardContent className="p-6 md:p-8 space-y-6">
            <div>
              <h3 className="font-bold text-base text-foreground mb-2">Your Alphanumeric Referral Code</h3>
              <div className="flex bg-secondary/30 border p-3 rounded-xl justify-between items-center font-mono font-bold text-lg tracking-wider text-primary">
                <span>{stats?.referral_code}</span>
                <Badge variant="outline" className="bg-background text-[10px]">Active</Badge>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-base text-foreground mb-2">Your Personal Referral Link</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getRefLink()}
                  className="flex-1 bg-secondary/20 border px-4 rounded-xl text-xs font-medium outline-none text-muted-foreground select-all h-11 min-w-0"
                />
                <Button onClick={copyLink} variant="secondary" className="rounded-xl h-11 flex items-center justify-center gap-1.5 shrink-0 px-4">
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span className="text-xs font-bold hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={getWhatsAppShare()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 bg-[#25D366] hover:bg-[#20ba59] transition text-white rounded-full flex items-center justify-center gap-2 font-bold text-sm shadow-soft cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Share link on WhatsApp
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Stats Panel */}
        <div className="space-y-6">
          <Card className="radius-xl border shadow-soft bg-primary text-primary-foreground relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-accent/20 rounded-full blur-xl" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-primary-foreground/60 font-semibold">Rewards Claimed</span>
                <Award className="w-8 h-8 text-accent animate-pulse" />
              </div>
              <h3 className="text-3xl font-extrabold font-display text-white">₹{stats?.rewards_earned}</h3>
              <p className="text-[10px] text-primary-foreground/70 mt-2">Earned through signup coupons</p>
            </CardContent>
          </Card>

          <Card className="radius-xl border shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Referred</span>
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-3xl font-extrabold font-display">{stats?.referred_count}</h3>
              <p className="text-[10px] text-muted-foreground mt-2">Businesses successfully signed up</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Referral Log List */}
      <div className="mt-12">
        <h3 className="font-display font-extrabold text-xl mb-6 flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          Referred Signups
        </h3>
        <Card className="radius-xl border shadow-soft overflow-hidden">
          <CardContent className="p-0">
            {!stats?.referred_users || stats.referred_users.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Users className="w-8 h-8 text-muted-foreground/35 mx-auto mb-2" />
                <p className="font-medium text-sm">No referrals yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Share your link to earn your first reward coupon!</p>
              </div>
            ) : (
              <div className="divide-y">
                {stats.referred_users.map((r, idx) => (
                  <div key={idx} className="p-4 flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-primary text-xs">{idx + 1}</div>
                      <span className="font-mono text-foreground font-bold">{r.email}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
