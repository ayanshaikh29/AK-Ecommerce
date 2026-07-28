'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Filter, ChevronRight, RefreshCw, Star, Lock, MessageCircle, ShieldCheck } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/ui/ProductCard'
import { useAppContext } from '@/components/providers/AppProvider'
import { toast } from 'sonner'
import { useRealtimeProducts, useRealtimePricing } from '@/lib/hooks/useRealtime'
import { CatalogAccessPendingCard } from '@/components/ui/CatalogAccessPendingCard'
import { useCustomerCatalogAccess } from '@/lib/hooks/useCatalogAccessRealtime'

function useScrollReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' })
    document.querySelectorAll('.reveal:not(.in-view), .reveal-scale:not(.in-view)').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, deps)
}

class ProductsErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ProductsView Error Boundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto my-16 p-8 text-center bg-card border border-border/80 rounded-3xl shadow-soft">
          <Badge className="mb-4 bg-amber-500/20 text-amber-600 border-amber-500/30 px-3 py-1 text-xs uppercase font-extrabold">
            Catalog Notice
          </Badge>
          <h2 className="font-display text-2xl md:text-4xl font-extrabold mb-4 text-foreground">
            Product Catalog Unavailable
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto mb-8 leading-relaxed">
            We encountered a temporary issue while loading your customer catalog. Please try refreshing or contact support to verify your assigned pricing access.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button onClick={() => window.location.reload()} className="rounded-full px-6 gold-gradient text-primary font-bold">
              Refresh Page
            </Button>
            <a href="https://wa.me/918308860894" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="rounded-full px-6 border-border">
                Contact Support
              </Button>
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function ProductsView(props) {
  return (
    <ProductsErrorBoundary>
      <ProductsViewContent {...props} />
    </ProductsErrorBoundary>
  )
}

function ProductsViewContent({ initialProducts = [], cats = [], initialCategory = '', initialSearch = '', initialSort = 'newest', initialMinPrice = 0, initialMaxPrice = 15000, initialBrand = '', initialRating = 0 }) {
  const { user } = useAppContext()
  const router = useRouter()
  const [sort, setSort] = useState(initialSort)
  const [priceRange, setPriceRange] = useState([initialMinPrice, initialMaxPrice])
  const [selectedCat, setSelectedCat] = useState(initialCategory)
  const [selectedBrands, setSelectedBrands] = useState(initialBrand ? initialBrand.split(',') : [])
  const [selectedRating, setSelectedRating] = useState(initialRating || 0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Always start loading=true for customers — user from context may be null on first render
  // so we can't rely on user?.role === 'customer' at mount time
  const [customerCatalogState, setCustomerCatalogState] = useState({
    loading: true,
    locked: false,
    products: null
  })

  const loadCustomerCatalog = useCallback(async () => {
    if (!user || user?.role !== 'customer') {
      setCustomerCatalogState({ loading: false, locked: false, products: null })
      return
    }
    setCustomerCatalogState(prev => ({ ...prev, loading: true }))
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      const q = new URLSearchParams()
      if (selectedCat) q.set('category', selectedCat)
      if (initialSearch) q.set('search', initialSearch)
      if (sort && sort !== 'newest') q.set('sort', sort)
      
      const res = await fetch('/api/products?' + q.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.catalog_locked === true) {
          setCustomerCatalogState({ loading: false, locked: true, products: [] })
        } else {
          setCustomerCatalogState({ loading: false, locked: false, products: Array.isArray(data.products) ? data.products : [] })
        }
      } else if (res.status === 401) {
        setCustomerCatalogState({ loading: false, locked: true, products: [] })
      } else {
        setCustomerCatalogState({ loading: false, locked: false, products: [] })
      }
    } catch {
      setCustomerCatalogState({ loading: false, locked: false, products: [] })
    }
  }, [user, selectedCat, initialSearch, sort])

  useRealtimeProducts(loadCustomerCatalog)
  useRealtimePricing(loadCustomerCatalog)

  // Real-time catalog unlock listener when Admin approves catalog request
  useCustomerCatalogAccess(user, useCallback((payload) => {
    if (payload?.status === 'approved') {
      toast.success('Catalog Access Approved!', {
        description: 'Your account has been granted access. Unlocking catalog live.'
      })
      loadCustomerCatalog()
    } else if (payload?.status === 'rejected') {
      toast.error('Catalog Access Request Rejected', {
        description: 'Your request for custom catalog access was not approved.'
      })
    }
  }, [loadCustomerCatalog]))

  // Catalog load effect
  useEffect(() => {
    loadCustomerCatalog()
  }, [loadCustomerCatalog])

  // Hook 12: effectiveProducts
  const effectiveProducts = useMemo(() => {
    if (user?.role === 'customer') {
      return Array.isArray(customerCatalogState.products) ? customerCatalogState.products : []
    }
    return Array.isArray(initialProducts) ? initialProducts : []
  }, [user, customerCatalogState.products, initialProducts])

  // Hook 13: scroll reveal
  useScrollReveal([effectiveProducts])

  // Hook 14: sync params effect
  useEffect(() => {
    setSelectedCat(initialCategory)
    setPriceRange([initialMinPrice, initialMaxPrice])
    setSort(initialSort)
    setSelectedBrands(initialBrand ? initialBrand.split(',') : [])
    setSelectedRating(initialRating || 0)
  }, [initialCategory, initialMinPrice, initialMaxPrice, initialSort, initialBrand, initialRating])

  // Hook 15: allBrands
  const allBrands = useMemo(() => {
    const brands = (Array.isArray(effectiveProducts) ? effectiveProducts : []).map(p => p?.brand).filter(Boolean)
    return Array.from(new Set(brands)).sort()
  }, [effectiveProducts])

  // Hook 16: filteredProducts
  const filteredProducts = useMemo(() => {
    let list = Array.isArray(effectiveProducts) ? [...effectiveProducts] : []

    if (selectedBrands.length > 0) {
      list = list.filter(p => p && selectedBrands.includes(p.brand || 'AK Quality'))
    }
    if (selectedRating > 0) {
      list = list.filter(p => p && (p.rating_avg || 4.5) >= selectedRating)
    }
    if (inStockOnly) {
      list = list.filter(p => p && (p.stock_quantity ?? 0) > 0)
    }
    list = list.filter(p => p && (p.price || 0) >= (priceRange[0] || 0) && (p.price || 0) <= (priceRange[1] || 15000))

    return list
  }, [effectiveProducts, selectedBrands, selectedRating, inStockOnly, priceRange])

  // ========================================================
  // ALL 16 HOOKS DECLARED UNCONDITIONALLY AT TOP LEVEL ABOVE
  // ========================================================

  const applyFilters = (newCat, newSort, newPrice, newBrands, newRating) => {
    const cat = newCat !== undefined ? newCat : selectedCat
    const s = newSort !== undefined ? newSort : sort
    const p = newPrice !== undefined ? newPrice : priceRange
    const brs = newBrands !== undefined ? newBrands : selectedBrands
    const rat = newRating !== undefined ? newRating : selectedRating
    
    const q = new URLSearchParams()
    if (cat) q.set('category', cat)
    if (initialSearch) q.set('search', initialSearch)
    if (s && s !== 'newest') q.set('sort', s)
    if (p[0] > 0) q.set('minPrice', p[0])
    if (p[1] < 15000) q.set('maxPrice', p[1])
    if (brs.length > 0) q.set('brand', brs.join(','))
    if (rat > 0) q.set('rating', rat)
    
    router.push('/products?' + q.toString())
  }

  const toggleBrand = (brand) => {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand]
    setSelectedBrands(next)
    applyFilters(undefined, undefined, undefined, next, undefined)
  }

  const toggleRating = (ratingVal) => {
    const next = selectedRating === ratingVal ? 0 : ratingVal
    setSelectedRating(next)
    applyFilters(undefined, undefined, undefined, undefined, next)
  }

  const clearAllFilters = () => {
    setSelectedBrands([])
    setSelectedRating(0)
    setInStockOnly(false)
    setPriceRange([0, 15000])
    setSelectedCat('')
    applyFilters('', 'newest', [0, 15000], [], 0)
  }

  const categoryName = selectedCat && Array.isArray(cats) ? cats.find(c => c?.slug === selectedCat)?.name : null

  // 1. If Logged Out: Render Informational Category Overview
  if (!user) {
    return <LoggedOutProductsInfoView cats={Array.isArray(cats) ? cats : []} />
  }

  // 2. If Logged in Customer with No Catalog Access granted yet: Render WhatsApp CTA Screen
  if (user.role === 'customer' && !customerCatalogState.loading && customerCatalogState.locked) {
    return <CatalogAccessPendingView user={user} />
  }

  const FiltersSidebar = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <h3 className="font-display font-extrabold text-lg uppercase tracking-wider text-foreground">Filters</h3>
        <button 
          onClick={clearAllFilters} 
          className="text-xs text-accent hover:text-accent/80 font-bold flex items-center gap-1 transition"
        >
          <RefreshCw className="w-3 h-3" /> Clear All
        </button>
      </div>

      {/* Category Section */}
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-3 tracking-wide">Category</h4>
        <div className="space-y-2">
          <button 
            onClick={() => { setSelectedCat(''); applyFilters(''); setFilterOpen(false) }} 
            className={`block w-full text-left text-sm py-1 px-2 rounded-lg transition-colors ${!selectedCat ? 'bg-secondary text-accent font-bold' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'}`}
          >
            All Collections
          </button>
          {cats.map(c => (
            <button 
              key={c.id} 
              onClick={() => { setSelectedCat(c.slug); applyFilters(c.slug); setFilterOpen(false) }} 
              className={`block w-full text-left text-sm py-1 px-2 rounded-lg transition-colors ${selectedCat === c.slug ? 'bg-secondary text-accent font-bold' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Section */}
      <div className="pt-4 border-t">
        <h4 className="font-semibold text-sm text-foreground mb-3 tracking-wide">Price (₹)</h4>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Min</span>
            <Input 
              type="number" 
              value={priceRange[0]} 
              onChange={e => setPriceRange([+e.target.value, priceRange[1]])} 
              className="w-full pl-9 pr-2 h-9 text-xs rounded-lg"
            />
          </div>
          <span className="text-muted-foreground">-</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Max</span>
            <Input 
              type="number" 
              value={priceRange[1]} 
              onChange={e => setPriceRange([priceRange[0], +e.target.value])} 
              className="w-full pl-9 pr-2 h-9 text-xs rounded-lg"
            />
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          className="mt-3 w-full text-xs font-semibold rounded-lg h-9 border border-border"
          onClick={() => { applyFilters(undefined, undefined, priceRange); setFilterOpen(false) }}
        >
          Go
        </Button>
      </div>

      {/* Brand Filters Section */}
      {allBrands.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="font-semibold text-sm text-foreground mb-3 tracking-wide">Brand</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
            {allBrands.map(brand => (
              <label key={brand} className="flex items-center gap-2.5 text-sm cursor-pointer group text-muted-foreground hover:text-foreground transition-colors">
                <input 
                  type="checkbox" 
                  checked={selectedBrands.includes(brand)} 
                  onChange={() => toggleBrand(brand)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                />
                <span className="select-none text-xs">{brand}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Availability Section */}
      <div className="pt-4 border-t">
        <h4 className="font-semibold text-sm text-foreground mb-3 tracking-wide">Availability</h4>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer group text-muted-foreground hover:text-foreground transition-colors">
          <input 
            type="checkbox" 
            checked={inStockOnly} 
            onChange={e => setInStockOnly(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
          />
          <span className="select-none text-xs font-medium">In Stock Only</span>
        </label>
      </div>

      {/* Rating Filters Section */}
      <div className="pt-4 border-t">
        <h4 className="font-semibold text-sm text-foreground mb-3 tracking-wide">Customer Rating</h4>
        <div className="space-y-2">
          {[4, 3, 2].map(stars => (
            <button
              key={stars}
              onClick={() => toggleRating(stars)}
              className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg w-full text-left transition-colors ${
                selectedRating === stars ? 'bg-secondary text-accent font-bold' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
            >
              <div className="flex shrink-0">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= stars ? 'fill-accent text-accent' : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              <span>& Up</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-2">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link 
          href="/products" 
          onClick={() => { setSelectedCat(''); applyFilters(''); }} 
          className={`hover:text-foreground transition-colors ${!selectedCat ? 'font-semibold text-foreground' : ''}`}
        >
          Shop
        </Link>
        {categoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold text-foreground">{categoryName}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 slide-up">
        <div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
            {selectedCat ? categoryName : (initialSearch ? `Search results for "${initialSearch}"` : 'All Products')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">{filteredProducts.length} items found</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden rounded-full h-10 px-4">
                <Filter className="w-4 h-4 mr-1.5" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl overflow-y-auto p-6">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="mt-6"><FiltersSidebar /></div>
            </SheetContent>
          </Sheet>
          <Select 
            value={sort} 
            onValueChange={v => { setSort(v); applyFilters(undefined, v); }}
          >
            <SelectTrigger className="w-48 rounded-full h-10 px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest Arrival</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar for Desktop */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-24 self-start bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <FiltersSidebar />
        </aside>
        
        {/* Product Grid */}
        <div className="flex-1">
          {customerCatalogState.loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array(8).fill(0).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl skeleton" />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-24 border rounded-3xl border-dashed border-border/80 bg-secondary/10">
              <div className="max-w-xs mx-auto">
                <p className="font-display font-extrabold text-xl mb-1 text-foreground">No matches found</p>
                <p className="text-xs text-muted-foreground mb-4">Try clearing some filters or using different keywords.</p>
                <Button size="sm" onClick={clearAllFilters} className="rounded-full">Reset Filters</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((p, i) => (
                <div key={p.id} className="reveal" style={{ transitionDelay: `${(i % 8) * 40}ms` }}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoggedOutProductsInfoView({ cats }) {
  const whatsappUrl = `https://wa.me/918308860894?text=${encodeURIComponent('Hello AK Enterprises, I am visiting your site and would like to request catalog access & wholesale pricing.')}`

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-left">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <Badge className="mb-4 bg-accent/20 text-accent border-accent/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
          Informational Category Overview
        </Badge>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold text-foreground mb-4">
          Product Offerings & Categories
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          AK Enterprises is a private B2B supplier. Browse our category portfolio below. To view itemized SKUs, inventory availability, and customer-specific wholesale pricing, please log into your corporate portal account.
        </p>
      </div>

      <div className="space-y-12 mb-20">
        {[
          {
            title: 'Office Stationery & Printing Supplies',
            desc: 'Complete corporate desk and print logistics. We supply high-grade copier paper, specialty notebooks, writing instruments, files, desk organizers, toner cartridges, and desktop office devices.',
            features: ['A4 / A3 Copier Paper (75/80 GSM)', 'Pens, Markers & Writing Instruments', 'Executive Diaries & Registers', 'Storage Files & Folders']
          },
          {
            title: 'Housekeeping & Cleaning Sanitation',
            desc: 'Commercial facility maintenance and sanitation products. Formulated chemicals, floor disinfectants, industrial mops, handwashes, garbage bags, and tissue paper solutions.',
            features: ['Disinfectant Floor Cleaners 5L', 'Handwashes & Hand Sanitizers', 'Commercial Tissue Rolls & Napkins', 'Microfiber Mops & Sanitation Tools']
          },
          {
            title: 'UPS Systems & Power Backup Solutions',
            desc: 'Uninterrupted power supplies for corporate offices and data centers. High-reliability UPS units, industrial batteries, surge protectors, and power accessories.',
            features: ['Line-Interactive UPS (600VA - 2000VA)', 'Online Industrial UPS Systems', 'SMF / Tubular Batteries', 'Voltage Stabilizers & Power Cables']
          }
        ].map((sec, idx) => (
          <div key={idx} className="bg-card border rounded-3xl p-8 shadow-soft">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-3 text-foreground">{sec.title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">{sec.desc}</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {sec.features.map((feat, fIdx) => (
                <div key={fIdx} className="flex items-center gap-2 text-xs font-semibold text-foreground bg-secondary/40 p-3 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mesh-hero rounded-3xl p-10 text-center text-primary-foreground">
        <h2 className="font-display text-3xl font-extrabold mb-3">Request Custom B2B Catalog Access</h2>
        <p className="text-primary-foreground/80 text-sm max-w-xl mx-auto mb-6">
          Existing client? Log in to view your negotiated rate card. New enterprise buyer? Reach out to our team via WhatsApp to request an account.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="rounded-full px-8 bg-accent text-accent-foreground font-bold hover:bg-accent/90">
              Sign In to B2B Account
            </Button>
          </Link>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="rounded-full px-8 border border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white font-bold transition-all shadow-soft backdrop-blur-xs">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Procurement Desk
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}

function RequestCatalogButton({ user, className }) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleClick = async () => {
    if (sent) return
    setSubmitting(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/catalog-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: 'Customer requested catalog access from the products page' })
      })
      if (res.ok) {
        setSent(true)
        toast.success('Request sent to admin!', { description: 'Our team has been notified and will set up your catalog shortly.' })
      } else {
        toast.error('Could not send request. Please try WhatsApp instead.')
      }
    } catch (e) {
      toast.error('Error: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button size="lg" onClick={handleClick} disabled={submitting || sent} className={className}>
      {sent ? '✓ Request Sent' : submitting ? 'Sending...' : 'Request Catalog Access'}
    </Button>
  )
}

function CatalogAccessPendingView({ user }) {
  return <CatalogAccessPendingCard user={user} />
}

