'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Minus, Star, PlayCircle, Heart, ShoppingBag, Truck, Package, Shield, Zap, ChevronRight, FileText, Lock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAppContext } from '@/components/providers/AppProvider'
import { ProductCard } from '@/components/ui/ProductCard'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'

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

function useScrollReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' })
    document.querySelectorAll('.reveal:not(.in-view), .reveal-scale:not(.in-view)').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, deps)
}

class ProductDetailErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ProductDetailErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto my-16 p-8 text-center bg-card border border-border/80 rounded-3xl shadow-soft">
          <Badge className="mb-4 bg-amber-500/20 text-amber-600 border-amber-500/30 px-3 py-1 text-xs uppercase font-extrabold">
            Notice
          </Badge>
          <h2 className="font-display text-2xl md:text-4xl font-extrabold mb-4 text-foreground">
            Product Detail Unavailable
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto mb-8 leading-relaxed">
            We encountered an issue loading this product detail page. Please try refreshing or return to the shop catalog.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button onClick={() => window.location.reload()} className="rounded-full px-6 gold-gradient text-primary font-bold">
              Refresh Page
            </Button>
            <Link href="/products">
              <Button variant="outline" className="rounded-full px-6 border-border">
                Back to Shop Catalog
              </Button>
            </Link>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function ProductDetailView(props) {
  return (
    <ProductDetailErrorBoundary>
      <ProductDetailViewContent {...props} />
    </ProductDetailErrorBoundary>
  )
}

function ProductDetailViewContent({ initialProduct }) {
  const router = useRouter()
  const { user, addToCart } = useAppContext()
  const [product, setProduct] = useState(initialProduct)
  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [localReviews, setLocalReviews] = useState(initialProduct?.reviews || [])
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  
  // Q&A States
  const [qaList, setQaList] = useState([])
  const [questionText, setQuestionText] = useState('')
  const [qaLoading, setQaLoading] = useState(false)

  // Customer Access & Custom Price State
  const [accessState, setAccessState] = useState({
    loading: user?.role === 'customer',
    denied: false
  })

  const imgRef = useRef(null)

  useScrollReveal([product])

  // Track recently viewed product
  useEffect(() => {
    if (!product?.id) return
    try {
      const stored = localStorage.getItem('recently_viewed')
      let list = stored ? JSON.parse(stored) : []
      list = list.filter(item => item.id !== product.id)
      list.unshift({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        mrp: product.mrp,
        image: product.images?.[0] || product.image_url || '/placeholder.png'
      })
      if (list.length > 10) list.pop()
      localStorage.setItem('recently_viewed', JSON.stringify(list))
    } catch (e) {
      console.error('Error tracking recently viewed:', e)
    }
  }, [product?.id, product?.name, product?.slug, product?.price, product?.mrp, product?.images, product?.image_url])

  // Load Q&A questions
  useEffect(() => {
    if (!product?.id) return
    fetch(`/api/products/${product.id}/qa`)
      .then(r => r.json())
      .then(data => setQaList(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [product?.id])

  // Check customer pricing access & custom price from API
  useEffect(() => {
    if (user === undefined) return
    if (user?.role !== 'customer') {
      setAccessState({ loading: false, denied: false })
      return
    }

    let isMounted = true
    async function checkCustomerAccess() {
      setAccessState({ loading: true, denied: false })
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const targetSlug = initialProduct?.slug || initialProduct?.id
      if (!targetSlug) return

      try {
        const res = await fetch(`/api/products/${targetSlug}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (res.ok) {
          const freshData = await res.json()
          if (!isMounted) return
          setProduct(prev => ({ ...prev, ...freshData }))
          setAccessState({ loading: false, denied: false })
        } else if (res.status === 403 || res.status === 401) {
          if (isMounted) setAccessState({ loading: false, denied: true })
        } else {
          if (isMounted) setAccessState({ loading: false, denied: false })
        }
      } catch (err) {
        if (isMounted) setAccessState({ loading: false, denied: false })
      }
    }

    checkCustomerAccess()
    return () => { isMounted = false }
  }, [user, initialProduct?.slug, initialProduct?.id])

  // Check wishlist status on mount
  useEffect(() => {
    if (!user || !product?.id) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(items => {
        if (Array.isArray(items)) {
          setWishlisted(items.some(i => i.product?.id === product.id))
        }
      })
      .catch(() => {})
  }, [user, product?.id])

  // Compute media URLs and main display image
  const allMedia = [
    ...(product?.images || []).map(u => ({ type: 'image', url: u })),
    ...(product?.videos || []).map(u => ({ type: 'video', url: u }))
  ]
  const current = allMedia[imgIdx]
  const mainImgUrl = current?.url || product?.images?.[0] || product?.image_url || '/placeholder.png'
  const [mainImgSrc, setMainImgSrc] = useState(mainImgUrl)

  useEffect(() => {
    setMainImgSrc(mainImgUrl)
  }, [mainImgUrl])

  // ========================================================
  // ALL HOOKS FINISHED ABOVE - CONDITIONAL RENDERINGS BELOW
  // ========================================================

  if (!product) return <div className="text-center py-20">Product not found</div>

  // Access Denied Screen for unauthorized customers
  if (user?.role === 'customer' && !accessState.loading && accessState.denied) {
    const displayName = user?.full_name || user?.email || 'Customer'
    const whatsappUrl = `https://wa.me/918308860894?text=${encodeURIComponent(`Hello AK Enterprises, I would like to request catalog access for product: ${product?.name || 'this item'} (${user?.email}).`)}`
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-elevated overflow-hidden">
          <div className="w-16 h-16 gold-gradient rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glow">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          <h1 className="font-display text-2xl md:text-3xl font-extrabold mb-3 text-foreground">
            Access Restricted
          </h1>

          <p className="text-muted-foreground text-sm leading-relaxed mb-8 mx-auto">
            You don't have access to this product, <strong className="text-foreground">{displayName}</strong>. This item is not included in your assigned corporate catalog.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="rounded-full h-12 gold-gradient text-primary font-bold text-sm shadow-glow w-full">
                <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
                Request Access on WhatsApp
              </Button>
            </a>
            <Link href="/products">
              <Button size="lg" variant="outline" className="rounded-full h-12 border-border text-foreground font-semibold text-sm w-full">
                Back to Shop Catalog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const loadQa = () => {
    if (!product?.id) return
    fetch(`/api/products/${product.id}/qa`)
      .then(r => r.json())
      .then(data => setQaList(Array.isArray(data) ? data : []))
      .catch(console.error)
  }

  const submitQuestion = async () => {
    if (!user) { toast.error('Please sign in to ask a question'); return }
    if (!questionText.trim()) { toast.error('Please type a question'); return }
    setQaLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ question: questionText })
      })
      if (res.ok) {
        toast.success('Your question has been posted successfully')
        setQuestionText('')
        loadQa()
      } else {
        const d = await res.json()
        toast.error(d.message || 'Failed to post question')
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setQaLoading(false)
    }
  }

  const toggleWishlist = async () => {
    if (!user) { router.push('/login'); return }
    if (wishlistLoading) return
    setWishlistLoading(true)
    setWishlisted(prev => !prev)
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ product_id: product.id })
      })
      if (res.ok) {
        const data = await res.json()
        setWishlisted(data.status === 'added')
        toast.success(data.status === 'added' ? 'Added to wishlist' : 'Removed from wishlist')
      } else {
        setWishlisted(prev => !prev)
      }
    } catch {
      setWishlisted(prev => !prev)
    } finally {
      setWishlistLoading(false)
    }
  }

  const submitReview = async () => {
    if (!user) { toast.error('Please sign in to review'); return }
    if (!reviewText.trim()) { toast.error('Please write a review comment'); return }
    setReviewLoading(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ product_id: product.id, rating: reviewRating, comment: reviewText })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to post review')
      }
      
      const newReview = {
        id: Date.now().toString(),
        user_name: user.full_name || user.email,
        rating: reviewRating,
        comment: reviewText,
        created_at: new Date().toISOString()
      }
      setLocalReviews(prev => [newReview, ...prev])
      
      const newCount = (product.rating_count || 0) + 1
      const newAvg = ((product.rating_avg || 0) * (product.rating_count || 0) + reviewRating) / newCount
      setProduct(prev => ({ ...prev, rating_avg: +newAvg.toFixed(1), rating_count: newCount }))
      
      setReviewText('')
      setReviewRating(5)
      toast.success('Review posted! Thank you.')
    } catch (e) {
      toast.error('Failed to post review')
    } finally {
      setReviewLoading(false)
    }
  }

  const lowStock = (product.stock_quantity ?? 0) < 10 && (product.stock_quantity ?? 0) > 0

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-2">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link href="/products" className="hover:text-foreground transition-colors">Shop</Link>
        {product.category?.name && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link href={`/products?category=${product.category.slug}`} className="hover:text-foreground transition-colors">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold text-foreground truncate max-w-xs">{product.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12 mb-16">
        {/* Image Gallery */}
        <div className="slide-in-left">
          <div className="relative aspect-square radius-xl overflow-hidden bg-secondary mb-4 shadow-soft">
            {current?.type === 'video' ?
              <video src={current.url} controls autoPlay className="w-full h-full object-cover" /> :
              <Image 
                ref={imgRef} 
                src={mainImgSrc} 
                alt={product.name || 'Product'} 
                fill 
                onError={() => setMainImgSrc('/placeholder.png')}
                className="object-cover" 
                priority 
                sizes="(max-width: 768px) 100vw, 50vw" 
              />
            }
            {product.discount_percent > 0 && <div className="absolute top-6 left-6 gold-gradient text-primary rounded-full px-4 py-1.5 text-sm font-extrabold shadow-glow">{product.discount_percent}% OFF</div>}

            {/* Wishlist heart on image */}
            <button
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow-soft hover:scale-110 transition z-10 ${wishlistLoading ? 'opacity-60' : ''}`}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-5 h-5 transition-colors ${wishlisted ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {allMedia.map((m, i) => (
              <button key={i} onClick={() => setImgIdx(i)} className={`relative w-20 h-20 shrink-0 rounded-xl overflow-hidden transition ${imgIdx === i ? 'ring-2 ring-accent ring-offset-2' : 'opacity-70 hover:opacity-100'}`}>
                {m.type === 'video' ? (
                  <>
                    <video src={m.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><PlayCircle className="w-6 h-6 text-white" /></div>
                  </>
                ) : (
                  <Image src={m.url} alt={product.name} width={80} height={80} className="w-full h-full object-cover" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="slide-in-right">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">{product.category?.name} {product.subcategory ? `• ${product.subcategory}` : ''}</p>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 text-balance leading-[1.05]">{product.name}</h1>
          <div className="flex items-center gap-2 mb-6">
            <div className="flex">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.round(product.rating_avg || 4.5) ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />)}
            </div>
            <span className="text-sm text-muted-foreground">{product.rating_avg || 4.5} · {product.rating_count || 0} reviews</span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-display text-4xl md:text-5xl font-extrabold text-primary">{formatINR(product.price)}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Inclusive of all taxes • GST invoice available</p>
          {lowStock && <div className="bg-destructive/10 text-destructive rounded-2xl p-4 text-sm font-semibold mb-5 bounce-in inline-flex items-center gap-2"><Zap className="w-4 h-4" />Only {product.stock_quantity} left — order soon!</div>}
          {product.stock_quantity === 0 && <div className="text-destructive font-bold mb-4">Out of stock</div>}
          <p className="text-muted-foreground mb-8 leading-relaxed">{product.description}</p>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-semibold">Qty</span>
            <div className="flex items-center border rounded-full">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3"><Minus className="w-4 h-4" /></button>
              <span className="px-5 font-semibold">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="p-3"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={(e) => { addRipple(e); addToCart(product, qty) }} disabled={product.stock_quantity === 0} className="w-full sm:flex-1 rounded-full h-14 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-bold shadow-glow text-sm sm:text-base px-6">
                <ShoppingBag className="w-5 h-5 mr-2" />Add to Cart
              </Button>
              <Button size="lg" onClick={(e) => { addRipple(e); addToCart(product, qty); router.push('/checkout') }} disabled={product.stock_quantity === 0} className="w-full sm:flex-1 rounded-full h-14 btn-shine ripple text-sm sm:text-base px-6">
                Buy Now
              </Button>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push(`/bulk-quote?product=${encodeURIComponent(product.name || '')}`)}
              className="w-full rounded-full h-14 font-semibold border-2 flex items-center justify-center gap-2 text-sm sm:text-base px-6"
            >
              <FileText className="w-5 h-5" /> Request Bulk Quote
            </Button>
          </div>

          <Separator className="my-8" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              [Truck, 'Free Shipping', 'On ₹1999+'],
              [Package, 'Easy Returns', '7-day policy'],
              [Shield, 'GST Invoice', 'B2B ready']
            ].map(([I, t, s], i) => (
              <div key={i}>
                <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center mb-2"><I className="w-5 h-5 text-primary" /></div>
                <p className="font-semibold">{t}</p><p className="text-muted-foreground text-xs">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="desc" className="mb-16 reveal">
        <TabsList className="rounded-full h-11 p-1 flex-nowrap overflow-x-auto no-scrollbar justify-start w-full">
          <TabsTrigger value="desc" className="rounded-full shrink-0">Description</TabsTrigger>
          <TabsTrigger value="specs" className="rounded-full shrink-0">Specifications</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-full shrink-0">Reviews ({localReviews.length})</TabsTrigger>
          <TabsTrigger value="qa" className="rounded-full shrink-0">Q&A ({qaList.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="desc" className="pt-6 text-muted-foreground leading-relaxed max-w-3xl text-lg">{product.description}</TabsContent>
        <TabsContent value="specs" className="pt-6 max-w-2xl">
          <table className="w-full text-sm">
            <tbody>
              {[
                ['SKU', product.sku],
                ['Category', product.category?.name],
                ['Sub-category', product.subcategory || 'Standard'],
                ['Availability', (product.stock_quantity ?? 0) > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'],
                ['Payment', 'COD, Bank Transfer'],
                ['Shipping', 'Pan India — 1-5 days']
              ].map(([k, v]) => (
                <tr key={k} className="border-b">
                  <td className="py-3 text-muted-foreground">{k}</td><td className="font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="reviews" className="pt-6 space-y-6">
          {user && (
            <Card className="radius-lg">
              <CardContent className="pt-6">
                <p className="font-bold mb-3">Write a Review</p>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} onClick={() => setReviewRating(i)} className="hover:scale-110 transition-transform">
                      <Star className={`w-7 h-7 transition-colors ${i <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/40 hover:text-accent'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground self-center">{reviewRating} star{reviewRating !== 1 ? 's' : ''}</span>
                </div>
                <Textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Tell others what you think about this product..."
                  className="mb-4 rounded-xl"
                  rows={3}
                />
                <Button onClick={submitReview} disabled={reviewLoading || !reviewText.trim()} className="rounded-full">
                  {reviewLoading ? 'Posting...' : 'Post Review'}
                </Button>
              </CardContent>
            </Card>
          )}
          {localReviews.length > 0 ? localReviews.map(r => (
            <div key={r.id} className="border-b pb-6 fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold shrink-0">{r.user_name?.[0]?.toUpperCase() || '?'}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />)}
                    </div>
                    <span className="text-sm font-bold">{r.user_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <p className="text-muted-foreground pl-13 leading-relaxed">{r.comment}</p>
            </div>
          )) : (
            <div className="text-center py-12 border border-dashed rounded-2xl">
              <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground font-medium">No reviews yet.</p>
              {user ? <p className="text-xs text-muted-foreground mt-1">Be the first to share your experience!</p> : <Link href="/login" className="text-xs text-primary font-semibold mt-1 block">Sign in to write a review</Link>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="qa" className="pt-6 space-y-6">
          <Card className="radius-lg">
            <CardContent className="pt-6">
              <p className="font-bold mb-3">Ask a Question</p>
              <Textarea
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder="Ask something about this product (e.g. dimensions, bulk capacity)..."
                className="mb-4 rounded-xl"
                rows={3}
              />
              <Button onClick={submitQuestion} disabled={qaLoading || !questionText.trim()} className="rounded-full">
                {qaLoading ? 'Posting...' : 'Ask Question'}
              </Button>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            {qaList.length > 0 ? qaList.map(q => (
              <div key={q.id} className="border-b pb-4 fade-in">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-foreground text-sm">Q: {q.question}</p>
                  <span className="text-[10px] text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</span>
                </div>
                <div className="pl-4 border-l-2 border-primary/20 bg-secondary/5 p-3 rounded-r-xl">
                  {q.answer ? (
                    <p className="text-xs text-foreground/80"><span className="font-bold text-primary mr-1">A:</span>{q.answer}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic"><span className="font-bold text-muted-foreground/60 mr-1">A:</span>No answer from seller yet. Typically answered in 2-4 hours.</p>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-center py-12 border border-dashed rounded-2xl">
                <p className="text-muted-foreground font-medium">No questions asked yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Have any questions about this item? Ask them above!</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {product.related?.length > 0 && (
        <div className="reveal">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {product.related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
      <RecentlyViewed />
    </div>
  )
}
