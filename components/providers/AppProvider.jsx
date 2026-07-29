'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter, usePathname } from 'next/navigation'

import { CartToastProvider, useCartToast } from './CartToastProvider'
import { RealtimeProvider } from './RealtimeProvider'

const AppContext = createContext(null)

function AppContentInner({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const { showCartToast } = useCartToast()

  // Multi-tab BroadcastChannel for realtime cart synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel('ak_cart_channel')
    
    channel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_CART' && Array.isArray(event.data.cart)) {
        setCart(event.data.cart)
      }
    }

    return () => channel.close()
  }, [])

  const broadcastCartUpdate = useCallback((newCart) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('ak_cart_channel')
        channel.postMessage({ type: 'SYNC_CART', cart: newCart })
        channel.close()
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')

    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        if (parsed?.role) {
          document.cookie = `user_role=${parsed.role}; path=/; max-age=604800`
          document.cookie = `auth_token=${storedToken}; path=/; max-age=604800`
        }

        // Verify token with backend /api/auth/me
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        })
          .then(res => {
            if (res.ok) return res.json()
            throw new Error('Token invalid')
          })
          .then(data => {
            if (data?.user) {
              setUser(data.user)
              localStorage.setItem('user', JSON.stringify(data.user))
              document.cookie = `user_role=${data.user.role}; path=/; max-age=604800`
              document.cookie = `auth_token=${storedToken}; path=/; max-age=604800`
            }
          })
          .catch(() => {
            localStorage.removeItem('user')
            localStorage.removeItem('token')
            document.cookie = 'user_role=; path=/; max-age=0'
            document.cookie = 'auth_token=; path=/; max-age=0'
            setUser(null)
          })
      } catch (e) {
        setUser(null)
      }
    } else {
      localStorage.removeItem('user')
      document.cookie = 'user_role=; path=/; max-age=0'
      document.cookie = 'auth_token=; path=/; max-age=0'
      setUser(null)
    }

    const storedCart = localStorage.getItem('cart')
    if (storedCart) {
      try { setCart(JSON.parse(storedCart)) } catch (e) {}
    }
  }, [])

  // Top-level Admin Route Protection: If logged in as admin and not on /admin route, redirect immediately
  useEffect(() => {
    const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('token') : false
    if (user?.role === 'admin' && hasToken && pathname && !pathname.startsWith('/admin')) {
      document.cookie = `user_role=admin; path=/; max-age=604800`
      const token = localStorage.getItem('token')
      if (token) document.cookie = `auth_token=${token}; path=/; max-age=604800`
      router.replace('/admin')
    }
  }, [user, pathname, router])

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = useCallback((product, qty = 1) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id)
      let nx
      if (idx >= 0) {
        nx = [...prev]
        nx[idx].quantity += qty
      } else {
        nx = [...prev, { 
          product_id: product.id, 
          product_name_snapshot: product.name, 
          price_snapshot: product.price, 
          quantity: qty, 
          image: product.images?.[0] || product.image 
        }]
      }
      broadcastCartUpdate(nx)
      return nx
    })
    showCartToast(product, qty)
  }, [broadcastCartUpdate, showCartToast])

  const updateQty = useCallback((id, qty) => {
    setCart(prev => {
      let nx
      if (qty <= 0) {
        nx = prev.filter(i => i.product_id !== id)
      } else {
        nx = prev.map(i => i.product_id === id ? { ...i, quantity: qty } : i)
      }
      broadcastCartUpdate(nx)
      return nx
    })
  }, [broadcastCartUpdate])

  const removeItem = useCallback((id) => {
    setCart(prev => {
      const nx = prev.filter(i => i.product_id !== id)
      broadcastCartUpdate(nx)
      return nx
    })
  }, [broadcastCartUpdate])

  const clearCart = useCallback(() => {
    setCart([])
    broadcastCartUpdate([])
  }, [broadcastCartUpdate])

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price_snapshot * i.quantity, 0), [cart])

  const logout = useCallback(async () => {
    if (user) {
      // Record Logout activity event for Admin Dashboard
      try {
        const token = localStorage.getItem('token')
        fetch('/api/admin/activity-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: user.id,
            user_name: user.full_name || 'Customer',
            user_email: user.email,
            event_type: 'logout',
            title: `${user.full_name || 'Customer'} logged out`,
            description: `Logged out from portal at ${new Date().toLocaleTimeString('en-IN')}`
          })
        }).catch(() => {})
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/realtime-config')
      if (res.ok) {
        const { supabaseUrl, supabaseKey } = await res.json()
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js')
          const client = createClient(supabaseUrl, supabaseKey)
          await client.auth.signOut()
        }
      }
    } catch (e) {}

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'user_role=; path=/; max-age=0'
    document.cookie = 'auth_token=; path=/; max-age=0'
    setUser(null)
    router.push('/')
    toast.success('Signed out successfully')
  }, [user, router])

  const value = {
    user, setUser,
    cart, setCart, addToCart, updateQty, removeItem, clearCart,
    cartCount, cartTotal,
    cartOpen, setCartOpen,
    logout
  }

  // Prevent rendering customer-facing page layout if admin is logged in and landing outside /admin
  const isAdminOutsideAdminArea = user?.role === 'admin' && pathname && !pathname.startsWith('/admin')

  return (
    <AppContext.Provider value={value}>
      <RealtimeProvider>
        {isAdminOutsideAdminArea ? (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground font-medium">Redirecting to Admin Portal...</p>
            </div>
          </div>
        ) : children}
      </RealtimeProvider>
    </AppContext.Provider>
  )
}

export function AppProvider({ children }) {
  return (
    <CartToastProvider>
      <AppContentInner>{children}</AppContentInner>
    </CartToastProvider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
