'use client'

import React, { useState } from 'react'
import { 
  Activity, Search, Filter, ShoppingBag, User, CreditCard, 
  RefreshCw, Clock, CheckCircle2, ShieldCheck, Heart, FileText, Circle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActivityFeed, useLiveCustomers } from '@/lib/hooks/useAdminRealtime'

function formatRelative(dateStr) {
  if (!dateStr) return 'Just now'
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)

  if (diffSec < 15) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getEventBadge(eventType) {
  switch (eventType) {
    case 'order':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Order</Badge>
    case 'payment':
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">Payment</Badge>
    case 'login':
      return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]">Login</Badge>
    case 'signup':
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]">Signup</Badge>
    case 'wishlist':
      return <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20 text-[10px]">Wishlist</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">System</Badge>
  }
}

export function AdminLiveActivityFeed() {
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { activities, loading, refetch } = useActivityFeed(filterType, searchQuery)
  const { onlineUsers, onlineCount } = useLiveCustomers()

  const categories = [
    { id: 'all', label: 'All Activity' },
    { id: 'orders', label: 'Orders' },
    { id: 'logins', label: 'Logins & Auth' },
    { id: 'payments', label: 'Payments' },
    { id: 'customers', label: 'Customers' },
    { id: 'system', label: 'System' },
  ]

  return (
    <Card className="radius-lg shadow-soft border border-border/80 overflow-hidden">
      <CardContent className="p-6">
        {/* Header & Live Indicator */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-xl text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                Live Customer Activity Feed
              </h3>
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <Circle className="w-2 h-2 fill-emerald-500 animate-pulse" />
                LIVE ({onlineCount} Online)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time monitoring stream of logins, purchases, payment uploads, and account changes.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            className="rounded-xl text-xs flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter Pills & Search Input */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          {/* Category Tabs */}
          <div className="flex bg-secondary/60 p-1 rounded-2xl border overflow-x-auto scrollbar-none gap-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterType(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterType === c.id
                    ? 'gold-gradient text-primary shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, order #, or email..."
              className="pl-9 h-9 rounded-xl text-xs bg-background"
            />
          </div>
        </div>

        {/* Activity Feed List */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
          {activities.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary" />
              <p className="text-sm font-semibold text-foreground">No recent activity matching filter</p>
              <p className="text-xs text-muted-foreground mt-1">Real-time customer events will appear here automatically.</p>
            </div>
          ) : (
            activities.map((item, idx) => {
              const isUserOnline = item.user_id && onlineUsers.has(item.user_id)
              return (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition flex items-start gap-4 shadow-xs animate-in slide-in-from-top-2 duration-300 group"
                >
                  {/* Customer Avatar & Status Dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-full bg-secondary border border-border/80 flex items-center justify-center font-bold text-sm text-foreground">
                      {(item.user_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    {/* Live Online / Offline Dot */}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                        isUserOnline ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                      title={isUserOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {item.user_name || 'Customer'}
                        </span>
                        {getEventBadge(item.event_type)}
                      </div>

                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {formatRelative(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-foreground/90 leading-relaxed">
                      {item.title}
                    </p>

                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
