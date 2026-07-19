'use client'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { Phone, Mail, MapPin, User, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

export function ContactView({ settings = {} }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const submit = async e => { 
    e.preventDefault()
    setLoading(true)
    try { 
      await fetch('/api/contact', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f) 
      })
      setDone(true)
      toast.success('Message sent') 
    } catch { 
      toast.error('Failed to send message') 
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-16">
      <div className="text-center mb-12 slide-up">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Get in Touch</p>
        <h1 className="font-display text-5xl md:text-6xl font-extrabold mb-3 text-balance">Let's <span className="gold-shine">talk</span> business</h1>
        <p className="text-muted-foreground text-lg">Bulk orders, corporate quotes, product inquiries — we're here to help.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4 slide-in-left">
          {[
            [Phone, 'Mobile', settings.contact_phone || '+91 83088 60894', 'tel:' + (settings.contact_phone || '').replace(/\s/g, '')],
            [Mail, 'Email', settings.contact_email || 'akenterprises1411@gmail.com', 'mailto:' + (settings.contact_email || '')],
            [MapPin, 'Address', settings.contact_address || 'Pune, Maharashtra', null],
            [User, 'Contact Person', settings.contact_person || 'Mr. Sagar Lahole', null]
          ].map(([I, l, v, link], i) => (
            <div key={i} className="p-6 radius-lg bg-card shadow-soft card-lift flex gap-4">
              <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center shrink-0">
                <I className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{l}</p>
                {link ? <a href={link} className="font-semibold hover:text-accent">{v}</a> : <p className="font-semibold">{v}</p>}
              </div>
            </div>
          ))}
        </div>
        <Card className="radius-lg shadow-soft slide-in-right">
          <CardContent className="pt-6">
            <h3 className="font-display font-extrabold text-2xl mb-5">Send a message</h3>
            {done ? (
              <div className="text-center py-8 bounce-in">
                <div className="w-16 h-16 gold-gradient rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <p className="font-bold">Thank you!</p>
                <p className="text-muted-foreground text-sm">We'll respond within 2 hours.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Your Name</Label>
                  <Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input required type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea rows={4} required value={f.message} onChange={e => setF({ ...f, message: e.target.value })} placeholder="Tell us about your requirement..." className="rounded-xl" />
                </div>
                <Button type="submit" disabled={loading} onClick={addRipple} className="w-full h-12 rounded-full btn-shine ripple font-semibold" size="lg">
                  {loading ? <span className="btn-spinner mr-2"/> : 'Send Message'} {!loading && <ArrowRight className="ml-1 w-4 h-4" />}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
