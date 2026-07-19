'use client'
import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Building2, Phone, Mail, Package, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function BulkQuoteContent() {
  const searchParams = useSearchParams()
  const productFromUrl = searchParams.get('product') || ''

  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    products_needed: productFromUrl,
    quantity: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.contact_person || !form.phone || !form.products_needed) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/bulk-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
    } catch {
      toast.error('Failed to submit enquiry. Please try again or WhatsApp us.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="font-display text-3xl font-extrabold mb-3">Enquiry Received!</h1>
        <p className="text-muted-foreground mb-2">
          Thank you for your bulk order enquiry. Our team will contact you within <strong>2 business hours</strong> with a customized quote.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          For urgent orders, WhatsApp us at{' '}
          <a href="https://wa.me/918308860894" className="text-primary font-semibold underline">+91 83088 60894</a>
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setSubmitted(false); setForm({ company_name: '', contact_person: '', phone: '', email: '', products_needed: '', quantity: '', message: '' }) }} variant="outline" className="rounded-full">New Enquiry</Button>
          <Button asChild className="rounded-full"><Link href="/products">Browse Products</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/products" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 gold-gradient rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent">B2B</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight">Request Bulk Quote</h1>
          <p className="text-muted-foreground text-sm mt-1">For corporate orders of 50+ units — get customised pricing in 2 hours</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="md:col-span-2">
          <Card className="radius-lg shadow-soft">
            <CardContent className="pt-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Company Name
                  </Label>
                  <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="ABC Corporation Pvt Ltd" className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs font-semibold">Contact Person *</Label>
                  <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Mr. Rahul Sharma" className="h-11 rounded-xl" required />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs font-semibold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number *
                  </Label>
                  <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" type="tel" className="h-11 rounded-xl" required />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
                  </Label>
                  <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="purchase@company.com" type="email" className="h-11 rounded-xl" />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" /> Products Required *
                </Label>
                <Textarea
                  value={form.products_needed}
                  onChange={e => set('products_needed', e.target.value)}
                  placeholder="e.g. A4 Copier Paper 75 GSM, Lizol Floor Cleaner 5L, Scotch Tape..."
                  className="rounded-xl min-h-[80px]"
                  required
                />
              </div>

              <div>
                <Label className="mb-1.5 text-xs font-semibold">Approximate Quantity / Units</Label>
                <Input value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="e.g. 500 reams, 100 pieces, 50 boxes" className="h-11 rounded-xl" />
              </div>

              <div>
                <Label className="mb-1.5 text-xs font-semibold">Special Requirements / Message</Label>
                <Textarea
                  value={form.message}
                  onChange={e => set('message', e.target.value)}
                  placeholder="Delivery timeline, preferred brands, GST number, budget range, or any specific requirements..."
                  className="rounded-xl min-h-[80px]"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 rounded-full btn-shine font-semibold" size="lg">
                {loading ? 'Submitting...' : 'Submit Bulk Enquiry'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                We respond within 2 business hours • WhatsApp:{' '}
                <a href="https://wa.me/918308860894" className="text-primary font-semibold">+91 83088 60894</a>
              </p>
            </CardContent>
          </Card>
        </form>

        {/* Side Info */}
        <div className="space-y-4">
          {[
            { icon: '⚡', title: '2-Hour Response', desc: 'Get a custom quote from our B2B team within 2 business hours' },
            { icon: '🎯', title: 'Best Bulk Pricing', desc: 'Volume discounts from 10%–40% on most product categories' },
            { icon: '🧾', title: 'GST Invoice', desc: 'All orders come with proper GST tax invoice for your accounts team' },
            { icon: '🚚', title: 'Pan-India Delivery', desc: 'Free delivery on bulk orders. Same-day dispatch available in Pune' },
          ].map(item => (
            <Card key={item.title} className="radius-lg border-border/40 bg-card/50">
              <CardContent className="p-4 flex gap-3">
                <span className="text-2xl shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BulkQuotePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <BulkQuoteContent />
    </Suspense>
  )
}
