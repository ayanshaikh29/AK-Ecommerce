'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingCart, Trash2, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export default function WishlistPage() {
  const { user, addToCart } = useAppContext()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWishlist = async () => {
    try {
      const res = await fetch('/api/wishlist', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    if (mounted && !user) {
      router.push('/login?redirect=/wishlist')
      return
    }
    if (user) {
      fetchWishlist()
    }
  }, [user, mounted])

  const handleRemove = async (productId) => {
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ product_id: productId })
      })
      if (res.ok) {
        toast.success('Removed from wishlist')
        setItems(prev => prev.filter(i => i.product.id !== productId))
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to remove')
      }
    } catch (e) {
      toast.error('Error removing item')
    }
  }

  const handleAddToCart = (product) => {
    addToCart(product, 1)
  }

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/account" className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-secondary transition shrink-0">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">My Wishlist</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Your saved product selections</p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 border rounded-3xl border-dashed border-border/80 bg-secondary/10">
          <div className="max-w-xs mx-auto">
            <Heart className="w-12 h-12 text-muted-foreground/35 mx-auto mb-4" />
            <p className="font-display font-extrabold text-xl mb-1">Your wishlist is empty</p>
            <p className="text-xs text-muted-foreground mb-6">Explore our B2B collection and save items you want.</p>
            <Button size="sm" onClick={() => router.push('/products')} className="rounded-full">Explore Products</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 slide-up">
          {items.map(item => {
            const p = item.product
            return (
              <Card key={item.id} className="group border border-border/50 hover:border-accent/40 rounded-2xl bg-card overflow-hidden transition-all duration-300 hover:shadow-soft">
                <div className="relative aspect-square bg-secondary/30 border-b border-border/20">
                  <Image 
                    src={p.image || '/placeholder.png'} 
                    alt={p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-w-768px) 50vw, (max-w-1024px) 33vw, 25vw"
                  />
                  <button 
                    onClick={() => handleRemove(p.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/95 hover:bg-destructive hover:text-white flex items-center justify-center shadow-sm text-muted-foreground transition duration-300"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <CardContent className="p-4 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-tight">
                      <Link href={`/product/${p.slug}`}>
                        {p.name}
                      </Link>
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="font-display font-extrabold text-base text-foreground">{formatINR(p.price)}</span>
                      {p.mrp > p.price && (
                        <span className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={() => handleAddToCart(p)}
                    className="w-full mt-4 rounded-xl flex items-center justify-center gap-1.5 h-10 text-xs font-semibold"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
