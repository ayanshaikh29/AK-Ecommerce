'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingBag, Star, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/components/providers/AppProvider'
import { useRouter } from 'next/navigation'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

function addRipple(e) {
  const btn = e.currentTarget; if (!btn) return
  const rect = btn.getBoundingClientRect()
  const r = document.createElement('span')
  const size = Math.max(rect.width, rect.height)
  r.className = 'ripple-el'
  r.style.width = r.style.height = size + 'px'
  r.style.left = (e.clientX - rect.left - size / 2) + 'px'
  r.style.top = (e.clientY - rect.top - size / 2) + 'px'
  btn.appendChild(r)
  setTimeout(() => r.remove(), 600)
}

// Global wishlist cache to avoid re-fetching for each card
let _wishlistCache = null
let _wishlistListeners = []

function notifyListeners() {
  _wishlistListeners.forEach(fn => fn(_wishlistCache))
}

async function fetchWishlistGlobal() {
  const token = localStorage.getItem('token')
  if (!token) { _wishlistCache = new Set(); notifyListeners(); return }
  try {
    const res = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      _wishlistCache = new Set(data.map(i => i.product?.id).filter(Boolean))
    } else {
      _wishlistCache = new Set()
    }
  } catch {
    _wishlistCache = new Set()
  }
  notifyListeners()
}

export function ProductCard({ product }) {
  const { addToCart, user } = useAppContext()
  const router = useRouter()
  const [hover, setHover] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  // Subscribe to global wishlist cache
  useEffect(() => {
    if (!user) { setWishlisted(false); return }

    const listener = (cache) => {
      if (cache) setWishlisted(cache.has(product.id))
    }
    _wishlistListeners.push(listener)

    if (_wishlistCache === null) {
      fetchWishlistGlobal()
    } else {
      setWishlisted(_wishlistCache.has(product.id))
    }

    return () => {
      _wishlistListeners = _wishlistListeners.filter(fn => fn !== listener)
    }
  }, [user, product.id])

  const add = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addRipple(e)
    addToCart(product, 1)
  }

  const toggleWishlist = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      router.push('/login')
      return
    }
    if (wishlistLoading) return
    setWishlistLoading(true)
    const newState = !wishlisted
    setWishlisted(newState) // optimistic
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ product_id: product.id })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'added') {
          _wishlistCache?.add(product.id)
          toast.success('Added to wishlist', { description: product.name })
        } else {
          _wishlistCache?.delete(product.id)
          toast.success('Removed from wishlist')
        }
        notifyListeners()
      } else {
        setWishlisted(!newState) // revert
        toast.error('Failed to update wishlist')
      }
    } catch {
      setWishlisted(!newState)
      toast.error('Failed to update wishlist')
    } finally {
      setWishlistLoading(false)
    }
  }

  return (
    <div
      className="group cursor-hover bg-card rounded-2xl overflow-hidden border border-border/60 hover:border-accent/40 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={'/product/' + product.slug} className="block relative aspect-[4/3] w-full overflow-hidden bg-secondary/30 shrink-0 border-b border-border/40">
        <Image
          src={product.images?.[hover && product.images[1] ? 1 : 0] || '/placeholder.png'}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {product.videos?.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 glass-dark text-white px-2 py-0.5 rounded text-[10px] backdrop-blur font-medium">
            <PlayCircle className="w-3 h-3" />
            Video
          </div>
        )}
        {product.discount_percent > 0 && (
          <div className="absolute top-2.5 right-2.5 gold-gradient text-primary rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow-soft">
            {product.discount_percent}% OFF
          </div>
        )}
        <button
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className={`absolute bottom-2.5 right-2.5 w-8 h-8 glass-strong rounded-full flex items-center justify-center hover:scale-110 transition shadow-sm z-10 ${wishlistLoading ? 'opacity-50' : ''}`}
          aria-label={wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 transition-colors ${wishlisted ? 'fill-rose-500 text-rose-500' : 'text-foreground hover:text-rose-500'}`} />
        </button>
      </Link>
      <div className="p-3.5 flex flex-col flex-1">
        <Link href={'/product/' + product.slug} className="block flex-1">
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] leading-snug text-foreground hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <div className="flex">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${i <= Math.round(product.rating_avg || 4.5) ? 'fill-accent text-accent' : 'text-muted-foreground/35'}`}
                />
              ))}
            </div>
            <span className="ml-1 text-foreground/90 font-semibold">{product.rating_avg || '4.5'}</span>
            <span className="text-[10px]">({product.rating_count || 12})</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-base text-foreground">
              {formatINR(product.price)}
            </span>
            {product.mrp > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatINR(product.mrp)}
              </span>
            )}
          </div>
        </Link>
        <div className="mt-3.5 pt-1.5 border-t border-border/40">
          <Button
            onClick={add}
            size="sm"
            className="w-full rounded-full h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 shadow-sm text-xs btn-press"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}
