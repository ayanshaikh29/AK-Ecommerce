'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRealtimeContext } from '@/components/providers/RealtimeProvider'
import { useAppContext } from '@/components/providers/AppProvider'

/**
 * Custom Hook: Realtime Orders Feed
 * Re-runs fetch callback instantly whenever an order is INSERTED or UPDATED
 */
export function useRealtimeOrders(fetchCallback) {
  const { orderSequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [orderSequence])

  return {
    realtimeStatus: status,
    lastOrderEvent: lastEvent?.table === 'orders' ? lastEvent : null
  }
}

/**
 * Custom Hook: Realtime Products Feed
 * Re-runs fetch callback instantly whenever products table changes (price, stock, visibility, details)
 */
export function useRealtimeProducts(fetchCallback) {
  const { productSequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [productSequence])

  return {
    realtimeStatus: status,
    lastProductEvent: lastEvent?.table === 'products' ? lastEvent : null
  }
}

/**
 * Custom Hook: Realtime Customer Roster & Approvals
 */
export function useRealtimeCustomers(fetchCallback) {
  const { customerSequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [customerSequence])

  return {
    realtimeStatus: status,
    lastCustomerEvent: lastEvent?.table === 'users' ? lastEvent : null
  }
}

/**
 * Custom Hook: Realtime Inventory & Stock Movements
 */
export function useRealtimeInventory(fetchCallback) {
  const { inventorySequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [inventorySequence])

  return {
    realtimeStatus: status,
    lastInventoryEvent: lastEvent?.table === 'stock_movements' || lastEvent?.table === 'products' ? lastEvent : null
  }
}

/**
 * Custom Hook: Realtime Customer-Specific Pricing (Custom Rate Cards)
 */
export function useRealtimePricing(fetchCallback) {
  const { pricingSequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [pricingSequence])

  return {
    realtimeStatus: status,
    lastPricingEvent: lastEvent?.table === 'customer_pricing' ? lastEvent : null
  }
}

/**
 * Custom Hook: Realtime Notifications & Counter
 */
export function useRealtimeNotifications() {
  const { notifications, unreadCount, markAllNotificationsRead, status } = useRealtimeContext()
  return {
    notifications,
    unreadCount,
    markAllNotificationsRead,
    realtimeStatus: status
  }
}

/**
 * Custom Hook: Realtime Admin Dashboard Metrics
 */
export function useRealtimeDashboard(fetchCallback) {
  const { orderSequence, productSequence, customerSequence, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current()
    }
  }, [orderSequence, productSequence, customerSequence])

  return {
    realtimeStatus: status
  }
}

/**
 * Custom Hook: Realtime Profile Updates for Logged-In User
 */
export function useRealtimeProfile(fetchCallback) {
  const { user } = useAppContext()
  const { customerSequence, lastEvent, status } = useRealtimeContext()
  const callbackRef = useRef(fetchCallback)

  useEffect(() => {
    callbackRef.current = fetchCallback
  }, [fetchCallback])

  useEffect(() => {
    if (lastEvent?.table === 'users' && lastEvent.newRow?.id === user?.id) {
      if (callbackRef.current) {
        callbackRef.current(lastEvent.newRow)
      }
    }
  }, [customerSequence, lastEvent, user?.id])

  return {
    realtimeStatus: status
  }
}
