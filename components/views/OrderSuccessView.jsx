'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OrderSuccessView() {
  const router = useRouter()
  const [order, setOrder] = useState(null)
  
  useEffect(() => { 
    const s = localStorage.getItem('lastOrder')
    if (s) setOrder(JSON.parse(s)) 
  }, [])
  
  return (
    <div className="max-w-xl mx-auto py-24 text-center px-4 bounce-in">
      <div className="w-24 h-24 gold-gradient rounded-full flex items-center justify-center mx-auto mb-8 pulse-glow shadow-glow">
        <CheckCircle2 className="w-14 h-14 text-primary" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">Order Placed!</h1>
      <p className="text-muted-foreground mb-2 text-lg">Thank you for shopping with AK Enterprises.</p>
      {order && <p className="font-mono text-sm mb-6">Order ID: <span className="font-bold text-foreground">{order.order_number}</span></p>}
      <p className="text-muted-foreground mb-8">We'll dispatch your order shortly.</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => router.push('/orders')} className="rounded-full">View Orders</Button>
        <Button variant="outline" onClick={() => router.push('/')} className="rounded-full">Home</Button>
      </div>
    </div>
  )
}
