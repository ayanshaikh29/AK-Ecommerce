import React from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'

export function Footer({ settings }) {
  return (
    <footer className="bg-primary text-primary-foreground/80 py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-display font-extrabold text-white text-xl shadow-soft group-hover:bg-white/20 transition-colors">AK</div>
            <div className="text-left leading-tight">
              <div className="font-display font-extrabold text-xl text-white tracking-tight">{settings?.brand_name || 'AK Enterprises'}</div>
              <div className="text-xs text-primary-foreground/60 uppercase tracking-[0.15em] font-medium">{settings?.brand_tagline || 'Trusted B2B Partner'}</div>
            </div>
          </Link>
          <p className="max-w-sm mb-8 leading-relaxed">Your one-stop destination for premium office stationery, housekeeping materials, and reliable UPS solutions. Delivering excellence since 2020.</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-accent shrink-0 mt-0.5"/><span className="text-sm">{settings?.contact_address || 'Pune - 411004'}</span></div>
            <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-accent shrink-0"/><span className="text-sm">{settings?.contact_phone || '+91 83088 60894'}</span></div>
            <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-accent shrink-0"/><span className="text-sm">{settings?.contact_email || 'akenterprises1411@gmail.com'}</span></div>
          </div>
        </div>
        <div>
          <h4 className="font-display text-lg font-bold text-white mb-6">Quick Links</h4>
          <div className="flex flex-col gap-3 text-sm">
            {[
              ['Home','/'],
              ['Shop All','/products'],
              ['Office Stationery','/products?category=office-stationery'],
              ['Housekeeping','/products?category=housekeeping'],
              ['UPS Solutions','/products?category=ups-solutions']
            ].map(([l,p])=><Link key={l} href={p} className="hover:text-accent transition-colors w-fit">{l}</Link>)}
          </div>
        </div>
        <div>
          <h4 className="font-display text-lg font-bold text-white mb-6">Company</h4>
          <div className="flex flex-col gap-3 text-sm">
            {[
              ['About Us','/about'],
              ['Contact Us','/contact'],
              ['Bulk Quote','/bulk-quote'],
              ['My Account','/account'],
              ['Track Order','/orders']
            ].map(([l,p])=><Link key={l} href={p} className="hover:text-accent transition-colors w-fit">{l}</Link>)}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <p>© {new Date().getFullYear()} {settings?.brand_name || 'AK Enterprises'}. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/terms-conditions" className="hover:text-white transition">Terms of Service</Link>
          <Link href="/refund-policy" className="hover:text-white transition">Refund Policy</Link>
        </div>
      </div>
    </footer>
  )
}
