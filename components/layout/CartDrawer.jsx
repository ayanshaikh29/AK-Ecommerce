'use client'
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Minus, Trash2, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppContext } from '@/components/providers/AppProvider'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateQty, removeItem, cartTotal } = useAppContext()

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="w-full sm:max-w-md bg-card/95 backdrop-blur-xl border-l-0 shadow-dramatic flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border/50 text-left">
          <SheetTitle className="font-display font-extrabold text-2xl flex items-center gap-3">
            Your Cart
            <span className="bg-primary text-primary-foreground text-xs px-2.5 py-1 rounded-full">{cart.length} items</span>
          </SheetTitle>
        </SheetHeader>
        
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 opacity-20"/>
            </div>
            <p className="font-medium text-lg text-foreground mb-1">Your cart is empty</p>
            <p className="text-sm">Looks like you haven't added anything yet.</p>
            <Button onClick={() => setCartOpen(false)} variant="outline" className="mt-6 rounded-full px-8">Continue Shopping</Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-6">
            <div className="flex flex-col gap-5">
              {cart.map((item, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="w-20 h-20 bg-secondary rounded-xl overflow-hidden shrink-0">
                    <Image src={item.image} alt="" width={80} height={80} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-sm line-clamp-2 leading-tight pr-6 relative">
                        {item.product_name_snapshot}
                        <button onClick={() => removeItem(item.product_id)} className="absolute right-0 top-0 text-muted-foreground hover:text-destructive transition"><X className="w-4 h-4"/></button>
                      </h4>
                      <p className="text-accent font-bold mt-1">{formatINR(item.price_snapshot)}</p>
                    </div>
                    <div className="flex items-center border rounded-xl overflow-hidden bg-background w-fit mt-2">
                      <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="p-1.5 hover:bg-secondary transition shrink-0"><Minus className="w-3.5 h-3.5"/></button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val)) updateQty(item.product_id, val)
                        }}
                        className="w-14 text-center font-bold text-xs bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-foreground font-mono"
                      />
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="p-1.5 hover:bg-secondary transition shrink-0"><Plus className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {cart.length > 0 && (
          <div className="p-6 bg-card border-t border-border/50 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-end mb-6">
              <span className="font-semibold text-muted-foreground">Subtotal</span>
              <div className="text-right">
                <span className="font-display font-extrabold text-2xl leading-none">{formatINR(cartTotal)}</span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Taxes included</p>
              </div>
            </div>
            <Link href="/checkout" onClick={() => setCartOpen(false)}>
              <Button className="w-full h-14 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 btn-press shadow-glow">Checkout Now</Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
