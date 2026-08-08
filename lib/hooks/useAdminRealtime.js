'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

let _supabaseSingleton = null

async function getAdminSupabase() {
  if (_supabaseSingleton) return _supabaseSingleton
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const res = await fetch('/api/admin/supabase-key', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const { supabaseUrl, supabaseKey } = await res.json()
      if (supabaseUrl && supabaseKey) {
        _supabaseSingleton = createClient(supabaseUrl, supabaseKey)
        return _supabaseSingleton
      }
    }
  } catch (e) {
    console.error('Failed to get Supabase credentials for Admin:', e?.message)
  }
  return null
}

/**
 * 1. useNotificationSound()
 * Audio chime manager for: 'order', 'login', 'payment'.
 * Includes mute / unmute state with localStorage persistence.
 */
export function useNotificationSound() {
  const [muted, setMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_sound_muted') === 'true'
    }
    return false
  })

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_sound_muted', String(next))
      }
      return next
    })
  }, [])

  const playSound = useCallback((type = 'chime') => {
    if (muted || typeof window === 'undefined') return

    try {
      // Clean HTML5 Web Audio API synthesized chime for zero external network dependency
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'

      if (type === 'order') {
        // High ascending double chime for new order
        osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      } else if (type === 'login') {
        // Gentle warm chime for customer login
        osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12) // E5
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      } else {
        // Payment uploaded / general alert
        osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15) // G5
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      }

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch (e) {
      console.warn('Audio playback note:', e)
    }
  }, [muted])

  return { muted, toggleMute, playSound }
}

/**
 * 2. useRealtimeNotifications()
 * Realtime unread counter, notification bell wiggle trigger, mark read, mark all read.
 */
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [bellWiggle, setBellWiggle] = useState(false)
  const { playSound } = useNotificationSound()

  const fetchInitialNotifications = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      const res = await fetch('/api/admin/activity-logs', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setNotifications(data)
          setUnreadCount(data.filter(n => !n.is_read).length)
        }
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    fetchInitialNotifications()

    let channel = null
    getAdminSupabase().then(client => {
      if (!client) return
      channel = client
        .channel('admin-realtime-notifications-hub')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs' },
          (payload) => {
            const newItem = payload.new
            setNotifications(prev => [newItem, ...prev].slice(0, 100))
            setUnreadCount(prev => prev + 1)

            // Trigger bell wiggle animation
            setBellWiggle(true)
            setTimeout(() => setBellWiggle(false), 800)

            // Sound cue based on event type
            if (newItem.event_type === 'order') playSound('order')
            else if (newItem.event_type === 'login') playSound('login')
            else if (newItem.event_type === 'payment') playSound('payment')
          }
        )
        .subscribe()
    })

    return () => {
      if (channel && _supabaseSingleton) {
        _supabaseSingleton.removeChannel(channel)
      }
    }
  }, [fetchInitialNotifications, playSound])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      await fetch('/api/admin/activity-logs', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'mark_all_read' })
      })
    } catch (e) {}
  }, [])

  const clearNotifications = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      await fetch('/api/admin/activity-logs', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'clear_all' })
      })
    } catch (e) {}
  }, [])

  return {
    notifications,
    unreadCount,
    bellWiggle,
    markAllRead,
    clearNotifications,
    refetch: fetchInitialNotifications
  }
}

/**
 * 3. useLiveCustomers() & useOnlineUsers()
 * Realtime online customer presence & last-seen status indicators.
 */
export function useLiveCustomers() {
  const [onlineUsers, setOnlineUsers] = useState(new Map())
  const [customerRoster, setCustomerRoster] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRoster = useCallback(async () => {
    setLoading(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      const res = await fetch('/api/admin/customer-logins', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setCustomerRoster(data)
      }
    } catch (e) {}
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoster()

    let presenceChannel = null
    getAdminSupabase().then(client => {
      if (!client) return
      presenceChannel = client.channel('online-customers-presence', {
        config: { presence: { key: 'admin-monitor' } }
      })

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState()
          const onlineMap = new Map()
          Object.values(state).forEach(presences => {
            presences.forEach(p => {
              if (p.userId) onlineMap.set(p.userId, { online: true, lastSeen: Date.now(), ...p })
            })
          })
          setOnlineUsers(onlineMap)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_logins' }, () => {
          fetchRoster()
        })
        .subscribe()
    })

    return () => {
      if (presenceChannel && _supabaseSingleton) {
        _supabaseSingleton.removeChannel(presenceChannel)
      }
    }
  }, [fetchRoster])

  const onlineCount = onlineUsers.size

  return {
    customerRoster,
    onlineUsers,
    onlineCount,
    loading,
    refetch: fetchRoster
  }
}

export function useOnlineUsers() {
  return useLiveCustomers()
}

/**
 * 4. useActivityFeed()
 * Stream of live activity feed (max 100 items), search & type filtering.
 */
export function useActivityFeed(filterType = 'all', searchQuery = '') {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  const loadActivities = useCallback(async () => {
    setLoading(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      const q = new URLSearchParams()
      if (filterType && filterType !== 'all') q.set('type', filterType)
      if (searchQuery) q.set('search', searchQuery)

      const res = await fetch(`/api/admin/activity-logs?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setActivities(data)
      }
    } catch (e) {}
    finally {
      setLoading(false)
    }
  }, [filterType, searchQuery])

  useEffect(() => {
    loadActivities()

    let feedChannel = null
    getAdminSupabase().then(client => {
      if (!client) return
      feedChannel = client
        .channel('admin-realtime-activity-stream')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
          const newItem = payload.new
          setActivities(prev => [newItem, ...prev].slice(0, 100))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_logins' }, () => {
          loadActivities()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
          loadActivities()
        })
        .subscribe()
    })

    return () => {
      if (feedChannel && _supabaseSingleton) {
        _supabaseSingleton.removeChannel(feedChannel)
      }
    }
  }, [loadActivities])

  return {
    activities,
    loading,
    refetch: loadActivities
  }
}
