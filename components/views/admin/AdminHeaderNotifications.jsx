'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Bell, Volume2, VolumeX, CheckCheck, Trash2, Clock, User, ShoppingBag, CreditCard, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRealtimeNotifications, useNotificationSound } from '@/lib/hooks/useAdminRealtime'

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Just now'
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)

  if (diffSec < 15) return 'Just now'
  if (diffSec < 60) return `${diffSec} seconds ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getEventIcon(eventType) {
  switch (eventType) {
    case 'order':
      return <ShoppingBag className="w-4 h-4 text-emerald-600" />
    case 'payment':
      return <CreditCard className="w-4 h-4 text-blue-600" />
    case 'login':
      return <User className="w-4 h-4 text-indigo-600" />
    default:
      return <ShieldCheck className="w-4 h-4 text-amber-600" />
  }
}

export function AdminHeaderNotifications() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { notifications, unreadCount, bellWiggle, markAllRead, clearNotifications } = useRealtimeNotifications()
  const { muted, toggleMute } = useNotificationSound()

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* Mute / Unmute Audio Sound Toggle */}
      <button
        onClick={toggleMute}
        className="p-2.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground relative group"
        title={muted ? "Sound Muted (Click to Unmute)" : "Sound Enabled (Click to Mute)"}
        aria-label="Toggle Sound Notifications"
      >
        {muted ? (
          <VolumeX className="w-5 h-5 text-destructive/80" />
        ) : (
          <Volume2 className="w-5 h-5 text-emerald-600" />
        )}
      </button>

      {/* Bell Notification Icon Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`p-2.5 rounded-full hover:bg-secondary transition-all relative ${
          bellWiggle ? 'animate-bounce scale-110 text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 gold-gradient text-primary text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow-soft animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-elevated overflow-hidden z-50 animate-in slide-in-from-top-3 fade-in duration-200">
          <div className="px-4 py-3 bg-secondary/40 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-sm text-foreground">Live Activity Feed</h3>
              {unreadCount > 0 && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2">
                  {unreadCount} New
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition flex items-center gap-1"
                title="Mark all read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">Mark Read</span>
              </button>
              <button
                onClick={clearNotifications}
                className="p-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/40 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">No activity notifications</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 hover:bg-secondary/40 transition flex items-start gap-3 relative ${
                    !item.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Event Icon / Avatar */}
                  <div className="w-8 h-8 rounded-full bg-secondary border flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    {getEventIcon(item.event_type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-foreground truncate">
                        {item.user_name || 'Customer'}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 font-medium line-clamp-1">{item.title}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
