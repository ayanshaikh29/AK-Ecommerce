'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) setUser(JSON.parse(storedUser))
    
    const storedCart = localStorage.getItem('cart')
    if (storedCart) setCart(JSON.parse(storedCart))
  }, [])

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = useCallback((product, qty = 1) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id)
      if (idx >= 0) {
        const nx = [...prev]
        nx[idx].quantity += qty
        return nx
      }
      return [...prev, { 
        product_id: product.id, 
        product_name_snapshot: product.name, 
        price_snapshot: product.price, 
        quantity: qty, 
        image: product.images?.[0] 
      }]
    })
    toast.success('Added to cart', { description: product.name })
  }, [])

  const updateQty = useCallback((id, qty) => {
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, quantity: Math.max(1, qty) } : i))
  }, [])

  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(i => i.product_id !== id))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price_snapshot * i.quantity, 0), [cart])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    router.push('/')
    toast.success('Signed out')
  }, [router])

  const value = {
    user, setUser,
    cart, setCart, addToCart, updateQty, removeItem, clearCart,
    cartCount, cartTotal,
    cartOpen, setCartOpen,
    logout
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
