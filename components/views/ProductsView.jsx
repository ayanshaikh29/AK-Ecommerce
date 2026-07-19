'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Filter, ChevronRight, RefreshCw } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCard } from '@/components/ui/ProductCard'

function useScrollReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' })
    document.querySelectorAll('.reveal:not(.in-view), .reveal-scale:not(.in-view)').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, deps)
}

export function ProductsView({ initialProducts, cats, initialCategory, initialSearch, initialSort, initialMinPrice, initialMaxPrice }) {
  const router = useRouter()
  const [sort, setSort] = useState(initialSort)
  const [priceRange, setPriceRange] = useState([initialMinPrice, initialMaxPrice])
  const [selectedCat, setSelectedCat] = useState(initialCategory)
  const [selectedBrands, setSelectedBrands] = useState([])
  const [inStockOnly, setInStockOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  useScrollReveal([initialProducts])

  // Sync state with URL params when they change
  useEffect(() => {
    setSelectedCat(initialCategory)
    setPriceRange([initialMinPrice, initialMaxPrice])
    setSort(initialSort)
  }, [initialCategory, initialMinPrice, initialMaxPrice, initialSort])

  // Get available brands dynamically based on category
  const allBrands = useMemo(() => {
    const brands = initialProducts.map(p => p.brand).filter(Boolean)
    return Array.from(new Set(brands)).sort()
  }, [initialProducts])

  // When filters change, push to router to trigger server refetch
  const applyFilters = (newCat, newSort, newPrice) => {
    const cat = newCat !== undefined ? newCat : selectedCat
    const s = newSort !== undefined ? newSort : sort
    const p = newPrice !== undefined ? newPrice : priceRange
    
    const q = new URLSearchParams()
    if (cat) q.set('category', cat)
    if (initialSearch) q.set('search', initialSearch)
    if (s && s !== 'newest') q.set('sort', s)
    if (p[0] > 0) q.set('minPrice', p[0])
    if (p[1] < 15000) q.set('maxPrice', p[1])
    
    router.push('/products?' + q.toString())
  }

  // Filter products on the client side for rapid UX response
  const filteredProducts = useMemo(() => {
    let list = [...initialProducts]

    // Brand filter
    if (selectedBrands.length > 0) {
      list = list.filter(p => selectedBrands.includes(p.brand))
    }

    // Stock availability filter
    if (inStockOnly) {
      list = list.filter(p => p.stock_quantity > 0)
    }

    // Price range filter
    list = list.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])

    return list
  }, [initialProducts, selectedBrands, inStockOnly, priceRange])

  const toggleBrand = (brand) => {
    setSelectedBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    )
  }

  const clearAllFilters = () => {
    setSelectedBrands([])
    setInStockOnly(false)
    setPriceRange([0, 15000])
    setSelectedCat('')
    applyFilters('', 'newest', [0, 15000])
  }

  const categoryName = selectedCat ? cats.find(c => c.slug === selectedCat)?.name : null

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
          {!initialProducts ? (
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
