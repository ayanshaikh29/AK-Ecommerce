import React from 'react'
import { Megaphone } from 'lucide-react'

export function TopMarquee({ settings }) {
  const msgs = settings?.marquee_messages?.length ? settings.marquee_messages : ['🚚 Free Pan-India Delivery on Bulk Orders']
  return (
    <div className="maroon-gradient text-primary-foreground overflow-hidden py-2.5 text-xs relative">
      <div className="flex whitespace-nowrap marquee-slow">
        {[...msgs, ...msgs, ...msgs].map((m,i) => (
          <span key={i} className="mx-10 inline-flex items-center gap-2 font-medium">{m}</span>
        ))}
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, hsl(0,55%,22%) 0%, transparent 8%, transparent 92%, hsl(0,55%,22%) 100%)' }} />
    </div>
  )
}

export function AdminMarquee() {
  const msgs = ['🔥 Upload product images & videos directly from your device', '📊 Live dashboard with orders, revenue & low-stock alerts', '⚙️ Manage banners, clients & site settings dynamically', '⚡ Add products in bulk via CSV import', '🎨 Every part of the storefront is admin-editable']
  return (
    <div className="gold-gradient text-primary overflow-hidden py-2.5 text-sm font-semibold border-b border-primary/20">
      <div className="flex whitespace-nowrap marquee-fast">
        {[...msgs, ...msgs].map((m,i) => (
          <span key={i} className="mx-10 inline-flex items-center gap-2">
            <Megaphone className="w-4 h-4"/>{m}
          </span>
        ))}
      </div>
    </div>
  )
}
