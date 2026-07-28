'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AddToCartToastContainer } from '@/components/ui/AddToCartToast'

const CartToastContext = createContext(null)

export function CartToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [cartBounce, setCartBounce] = useState(false)
  const timersRef = useRef(new Map())

  const dismissToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id).timerId)
      timersRef.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const startToastTimer = useCallback((id, duration = 4000) => {
    const timerId = setTimeout(() => {
      dismissToast(id)
    }, duration)

    timersRef.current.set(id, {
      timerId,
      startTime: Date.now(),
      duration,
      remaining: duration
    })
  }, [dismissToast])

  const pauseToast = useCallback((id) => {
    const timerInfo = timersRef.current.get(id)
    if (timerInfo && timerInfo.timerId) {
      clearTimeout(timerInfo.timerId)
      const elapsed = Date.now() - timerInfo.startTime
      const remaining = Math.max(1000, timerInfo.duration - elapsed)
      timersRef.current.set(id, { ...timerInfo, timerId: null, remaining, isPaused: true })
    }
  }, [])

  const resumeToast = useCallback((id) => {
    const timerInfo = timersRef.current.get(id)
    if (timerInfo && timerInfo.isPaused) {
      startToastTimer(id, timerInfo.remaining)
    }
  }, [startToastTimer])

  const showCartToast = useCallback((product, quantity = 1) => {
    if (!product) return

    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6)
    const newToast = { id, product, quantity }

    // Queue / Stack toasts: Limit to 3 active toasts max to keep UI clean
    setToasts(prev => [newToast, ...prev].slice(0, 3))

    // Start auto-dismiss timer
    startToastTimer(id, 4000)

    // Trigger cart icon bounce animation pulse
    setCartBounce(true)
    setTimeout(() => setCartBounce(false), 600)
  }, [startToastTimer])

  const value = {
    toasts,
    showCartToast,
    dismissToast,
    pauseToast,
    resumeToast,
    cartBounce
  }

  return (
    <CartToastContext.Provider value={value}>
      {children}
      <AddToCartToastContainer />
    </CartToastContext.Provider>
  )
}

export function useCartToast() {
  const context = useContext(CartToastContext)
  if (!context) {
    throw new Error('useCartToast must be used within a CartToastProvider')
  }
  return context
}
