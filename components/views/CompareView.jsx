'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, ShoppingBag, ArrowLeft, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useAppContext } from '@/components/providers/AppProvider'

export function CompareView() {
  const { addToCart } = useAppContext()
  const [list, setList] = useState([])
  const [mounted, setMounted] = useState(false)

  const load = () => {
    try {
      const stored = localStorage.getItem('compare_products')
      setList(stored ? JSON.parse(stored) : [])
    } catch {
      setList([])
    }
  }

  useEffect(() => {
    setMounted(true)
    load()
  }, [])

  const remove = (id) => {
    const updated = list.filter(p => p.id !== id)
    localStorage.setItem('compare_products', JSON.stringify(updated))
    window.dispatchEvent(new Event('compare-updated'))
    setList(updated)
    toast.success('Removed from comparison')
  }

  if (!mounted) return null

  if (list.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center slide-up">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h1 className="font-display text-3xl font-extrabold mb-4">No products selected</h1>
        <p className="text-muted-foreground mb-8">Go back to the shop and check "Compare" on products to view them side-by-side.</p>
        <Link href="/products">
          <Button className="rounded-full px-8 h-12 btn-shine font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Browse Products
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 slide-up">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/products" className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">Compare Products</h1>
          <p className="text-xs text-muted-foreground">Compare details, pricing, and specifications of up to 4 items.</p>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-2xl bg-card shadow-soft">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b bg-secondary/15">
              <th className="p-4 text-left font-bold text-xs md:text-sm text-muted-foreground w-1/5">Details</th>
              {list.map(p => (
                <th key={p.id} className="p-4 text-center border-l w-1/4 relative group">
                  <button
                    onClick={() => remove(p.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                    title="Remove from comparison"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="aspect-square w-32 h-32 mx-auto relative overflow-hidden bg-secondary/10 p-2 rounded-xl mb-4">
                    <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                  </div>
                  <Link href={`/product/${p.slug}`} className="block">
                    <h3 className="font-semibold text-xs md:text-sm text-foreground hover:text-primary transition line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </h3>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Price */}
            <tr className="border-b">
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">Price</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l">
                  <span className="font-extrabold text-primary text-sm md:text-base">₹{p.price.toLocaleString('en-IN')}</span>
                </td>
              ))}
            </tr>
            {/* Brand */}
            <tr className="border-b bg-secondary/5">
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">Brand</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l text-xs md:text-sm font-semibold">{p.brand || 'AK Premium'}</td>
              ))}
            </tr>
            {/* Rating */}
            <tr className="border-b">
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">Rating</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l">
                  <div className="flex justify-center items-center gap-1">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    <span className="text-xs md:text-sm font-bold">{p.rating_avg || '4.5'}</span>
                  </div>
                </td>
              ))}
            </tr>
            {/* Stock Status */}
            <tr className="border-b bg-secondary/5">
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">Stock Status</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l text-xs md:text-sm">
                  {p.stock_quantity > 0 ? (
                    <span className="text-emerald-600 font-bold">In Stock ({p.stock_quantity})</span>
                  ) : (
                    <span className="text-destructive font-bold">Out of Stock</span>
                  )}
                </td>
              ))}
            </tr>
            {/* SKU */}
            <tr className="border-b">
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">SKU / Item Code</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l text-xs font-mono">{p.sku || 'AK-N/A'}</td>
              ))}
            </tr>
            {/* Actions */}
            <tr>
              <td className="p-4 font-bold text-xs md:text-sm text-muted-foreground">Action</td>
              {list.map(p => (
                <td key={p.id} className="p-4 text-center border-l">
                  <Button
                    onClick={() => { addToCart(p, 1); toast.success('Added to Cart') }}
                    size="sm"
                    className="rounded-full px-4 h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 mx-auto text-xs shrink-0"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Add to Cart
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
