'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { getRealtimeClient } from '@/lib/realtime-client'
import { useAppContext } from './AppProvider'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { user } = useAppContext()
  const [status, setStatus] = useState('connecting') // connecting, connected, reconnecting, disconnected
  const [client, setClient] = useState(null)
  
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // System change sequence counters to notify consumer components to refresh target data slice without full reloads
  const [orderSequence, setOrderSequence] = useState(0)
  const [productSequence, setProductSequence] = useState(0)
  const [customerSequence, setCustomerSequence] = useState(0)
  const [inventorySequence, setInventorySequence] = useState(0)
  const [pricingSequence, setPricingSequence] = useState(0)
  const [lastEvent, setLastEvent] = useState(null)

  const activeChannelsRef = useRef(new Map())

  // Play subtle sound notification helper
  const playAlertSound = useCallback(() => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav')
      audio.volume = 0.5
      audio.play().catch(() => {})
    } catch (e) {}
  }, [])

  // Initialize Realtime Client
  useEffect(() => {
    let mounted = true
    async function init() {
      setStatus('connecting')
      const rtClient = await getRealtimeClient()
      if (mounted) {
        if (rtClient) {
          setClient(rtClient)
          setStatus('connected')
        } else {
          setStatus('disconnected')
        }
      }
    }
    init()
    return () => { mounted = false }
  }, [user?.id])

  // Setup Global Change Capture Channels
  useEffect(() => {
    if (!client) return

    const channelName = `global-realtime-${user?.id || 'anon'}`
    
    if (activeChannelsRef.current.has(channelName)) {
      client.removeChannel(activeChannelsRef.current.get(channelName))
    }

    const channel = client.channel(channelName)

    // 1. Orders table realtime changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload
        setOrderSequence(s => s + 1)
        setLastEvent({ table: 'orders', eventType, newRow, oldRow, timestamp: Date.now() })

        if (eventType === 'INSERT') {
          if (user?.role === 'admin') {
            playAlertSound()
            const orderNum = newRow.order_number || newRow.id?.slice(0, 8)
            toast.success(`New Order Received! #${orderNum}`, {
              description: `Total: ₹${Number(newRow.total || newRow.total_amount || 0).toLocaleString('en-IN')}`
            })
            setNotifications(prev => [{
              id: payload.commit_timestamp || Date.now().toString(),
              type: 'order_new',
              title: `New Order #${orderNum}`,
              message: `Total ₹${newRow.total || newRow.total_amount}`,
              time: new Date().toISOString(),
              data: newRow
            }, ...prev])
            setUnreadCount(c => c + 1)
          }
        } else if (eventType === 'UPDATE') {
          const orderNum = newRow.order_number || newRow.id?.slice(0, 8)

          // 1. Notification for Admin
          if (user?.role === 'admin') {
            playAlertSound()
            if (newRow.status === 'vendor_accepted' && oldRow?.status !== 'vendor_accepted') {
              toast.success(`🟢 Vendor Accepted Order #${orderNum}`, {
                description: `Logistics partner accepted dispatch assignment.`
              })
            } else if (newRow.assigned_vendor_id && !oldRow?.assigned_vendor_id) {
              toast.info(`🚚 Assigned Order #${orderNum} to Vendor`)
            } else {
              toast.info(`Order #${orderNum} status: ${newRow.status?.toUpperCase()}`)
            }
          }

          // 2. Notification for Customer
          if (user?.role === 'customer' && newRow.user_id === user.id) {
            playAlertSound()
            if (newRow.status === 'vendor_accepted' && oldRow?.status !== 'vendor_accepted') {
              toast.success(`🚚 Vendor Accepted Delivery for Order #${orderNum}`, {
                description: `Your order is being prepared for dispatch.`
              })
            } else {
              toast.info(`Order #${orderNum} status: ${newRow.status?.toUpperCase()}`, {
                description: `Your package status is now ${newRow.status}`
              })
            }
            setNotifications(prev => [{
              id: Date.now().toString(),
              type: 'order_status',
              title: `Order Status: ${newRow.status}`,
              message: `Order #${orderNum} updated`,
              time: new Date().toISOString(),
              data: newRow
            }, ...prev])
            setUnreadCount(c => c + 1)
          }

          // 3. Notification for Vendor — new assignment arrives in realtime
          if (user?.role === 'vendor') {
            playAlertSound()
            if (newRow.status === 'vendor_assigned' && oldRow?.status !== 'vendor_assigned') {
              toast.success(`📦 New Delivery Assigned! Order #${orderNum}`, {
                description: `Please review and accept dispatch request.`
              })
            }
          }
        }
      }
    )

    // 2. Products table realtime changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        const { eventType, new: newRow } = payload
        setProductSequence(s => s + 1)
        setInventorySequence(s => s + 1)
        setLastEvent({ table: 'products', eventType, newRow, timestamp: Date.now() })

        if (eventType === 'UPDATE' && newRow?.name) {
          if (newRow.stock_quantity <= 10 && newRow.stock_quantity > 0 && user?.role === 'admin') {
            toast.warning(`Low Stock Alert: ${newRow.name}`, {
              description: `Only ${newRow.stock_quantity} units remaining in stock.`
            })
          }
        }
      }
    )

    // 3. Customer Pricing realtime changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_pricing' },
      (payload) => {
        const { new: newRow } = payload
        setPricingSequence(s => s + 1)
        setLastEvent({ table: 'customer_pricing', timestamp: Date.now() })

        if (user && newRow?.user_id === user.id) {
          toast.info('Custom Rate Card Updated!', {
            description: 'Your assigned product catalog pricing has been updated live.'
          })
        }
      }
    )

    // 4. Users & Profiles table realtime changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      (payload) => {
        const { eventType, new: newRow } = payload
        setCustomerSequence(s => s + 1)
        setLastEvent({ table: 'users', eventType, newRow, timestamp: Date.now() })

        if (eventType === 'INSERT' && user?.role === 'admin') {
          toast.info(`New Customer Registered: ${newRow.full_name || newRow.email}`)
        }
      }
    )

    // 5. Notifications table realtime changes
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      (payload) => {
        const { eventType, new: newRow } = payload
        if (eventType === 'INSERT' && newRow) {
          if (user && newRow.user_id === user.id) {
            playAlertSound()
            setNotifications(prev => [{
              id: newRow.id || Date.now().toString(),
              type: newRow.type || 'notification',
              title: newRow.title || 'Notification',
              message: newRow.message || '',
              time: newRow.created_at || new Date().toISOString(),
              data: newRow,
              is_read: newRow.is_read || false
            }, ...prev])
            setUnreadCount(c => c + 1)
            if (newRow.type === 'vendor_assigned') {
              toast.info(newRow.title, { description: newRow.message })
            } else if (newRow.type === 'order_update') {
              toast.success(newRow.title, { description: newRow.message })
            }
          }
        }
      }
    )

    // 6. Catalog Requests table realtime changes
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'catalog_requests' },
      (payload) => {
        if (user?.role === 'admin') {
          playAlertSound()
          const req = payload.new
          toast.info(`Catalog Request from ${req.customer_name}`, {
            description: `${req.email || req.phone}: ${req.note || 'Requested catalog access'}`
          })
          setNotifications(prev => [{
            id: Date.now().toString(),
            type: 'catalog_request',
            title: `Catalog Request`,
            message: `${req.customer_name} requested catalog access`,
            time: new Date().toISOString(),
            data: req
          }, ...prev])
          setUnreadCount(c => c + 1)
        }
      }
    )

    // Subscribe channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected')
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setStatus('reconnecting')
      }
    })

    activeChannelsRef.current.set(channelName, channel)

    return () => {
      if (client && channel) {
        client.removeChannel(channel)
        activeChannelsRef.current.delete(channelName)
      }
    }
  }, [client, user, playAlertSound])

  const markAllNotificationsRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const value = {
    client,
    status,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    orderSequence,
    productSequence,
    customerSequence,
    inventorySequence,
    pricingSequence,
    lastEvent
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider')
  }
  return context
}
