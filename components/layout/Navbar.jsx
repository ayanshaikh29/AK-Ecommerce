'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Package, LogOut, User, ShoppingBag, Heart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/components/providers/AppProvider'
import { useCartToast } from '@/components/providers/CartToastProvider'

export function Navbar({ settings }) {
  const pathname = usePathname()
  const { user, cartCount, setCartOpen, logout } = useAppContext()
  const { cartBounce } = useCartToast()
  const router = useRouter()

  if (pathname?.startsWith('/admin') || pathname?.startsWith('/vendor')) return null
  const [scrolled, setScrolled] = useState(false)
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const searchRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    if (q.trim().length <= 1) {
      setSuggestions([])
      return
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.slice(0, 6)) // first 6 matches
        }
      } catch (err) {
        console.error('Error fetching search suggestions', err)
      }
    }, 250) // 250ms debounce
    return () => clearTimeout(delayDebounce)
  }, [q])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    const handleProfileOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleProfileOutside)
    return () => document.removeEventListener('mousedown', handleProfileOutside)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const submit = e => {
    e.preventDefault()
      if (q) {
        router.push('/products?search=' + encodeURIComponent(q))
      }
  }

  return (
    <header className={`sticky top-0 z-40 transition-all duration-500 ${scrolled ? 'glass-strong shadow-soft py-2' : 'glass py-3'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 rounded-2xl gold-gradient flex items-center justify-center font-display font-extrabold text-primary text-lg group-hover:rotate-6 transition-transform shadow-soft">
            AK
            <div className="absolute inset-0 rounded-2xl pulse-glow"/>
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <div className="font-display font-extrabold text-base tracking-tight">{settings?.brand_name || 'AK Enterprises'}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">{settings?.brand_tagline || 'Trusted B2B Partner'}</div>
          </div>
        </Link>
        {/* Desktop Navigation Links */}
        <nav className={`hidden lg:flex items-center gap-1 ${user ? 'ml-4' : 'mx-auto'} text-sm font-medium`}>
          {[
            ['Home', '/'],
            ['Shop', '/products'],
            ['About', '/about'],
            ['Contact', '/contact']
          ].map(([label, path]) => (
            <Link key={label} href={path} className="px-3 py-2 rounded-full hover:bg-secondary transition font-medium">
              {label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link href="/admin" className="ml-2 px-3 py-1.5 gold-gradient text-primary rounded-full text-xs font-bold shadow-soft">
              ADMIN
            </Link>
          )}
          {user?.role === 'vendor' && (
            <Link href="/vendor" className="ml-2 px-3 py-1.5 gold-gradient text-primary rounded-full text-xs font-bold shadow-soft">
              VENDOR PORTAL
            </Link>
          )}
        </nav>

        {/* Search Bar - Logged in users only */}
        {user ? (
          <div ref={searchRef} className="flex-1 max-w-sm hidden md:block ml-4 relative">
            <form onSubmit={submit}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input 
                  value={q} 
                  onChange={e => { setQ(e.target.value); setShowSuggestions(true) }} 
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search products..." 
                  className="pl-10 h-10 rounded-full bg-secondary/60 border-transparent focus-visible:bg-white focus-visible:shadow-soft transition"
                />
              </div>
            </form>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-background border rounded-2xl shadow-elevated overflow-hidden z-50 py-2 divide-y divide-border">
                {suggestions.map(p => (
                  <Link 
                    key={p.id}
                    href={'/product/' + p.slug}
                    onClick={() => { setShowSuggestions(false); setQ('') }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition text-left"
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-secondary shrink-0">
                      <Image src={p.images?.[0] || '/placeholder.png'} alt={p.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{p.subcategory}</p>
                    </div>
                    <div className="text-xs font-bold text-primary shrink-0">₹{p.price}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* User Account / Sign In & Cart Icons */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(prev => !prev)}
                  className="flex items-center gap-1.5 p-2.5 hover:bg-secondary rounded-full transition text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label="Account Menu"
                >
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name || 'User Profile'} 
                      className="w-6 h-6 rounded-full object-cover border border-border/80" 
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </button>
                
                {profileOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-background border rounded-2xl shadow-elevated overflow-hidden z-55 py-2 divide-y divide-border scale-in">
                    <div className="px-4 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Account ({user.role})</p>
                      <p className="text-sm font-bold text-foreground truncate mt-0.5">{user.full_name || 'Business Partner'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      {user.role === 'customer' && (
                        <>
                          <Link 
                            href="/account"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 transition text-muted-foreground hover:text-foreground font-medium"
                          >
                            <User className="w-4 h-4" /> My Profile
                          </Link>
                          <Link 
                            href="/orders"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 transition text-muted-foreground hover:text-foreground font-medium"
                          >
                            <Package className="w-4 h-4" /> My Orders
                          </Link>
                          <Link
                            href="/wishlist"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 transition text-muted-foreground hover:text-foreground font-medium"
                          >
                            <Heart className="w-4 h-4" /> Wishlist
                          </Link>
                        </>
                      )}
                      {user.role === 'admin' && (
                        <Link 
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 text-primary font-bold transition"
                        >
                          <Package className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      {user.role === 'vendor' && (
                        <Link 
                          href="/vendor"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 text-accent font-bold transition"
                        >
                          <Package className="w-4 h-4" /> Vendor Dashboard
                        </Link>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setProfileOpen(false); logout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/60 transition text-destructive font-medium text-left"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button 
                id="cart-icon" 
                onClick={() => setCartOpen(true)} 
                className={`relative p-2.5 hover:bg-secondary rounded-full transition-all duration-300 ${cartBounce ? 'scale-125 text-accent' : ''}`}
                aria-label="Open cart"
              >
                <ShoppingBag className={`w-5 h-5 transition-transform duration-300 ${cartBounce ? 'animate-bounce' : ''}`}/>
                {cartCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 gold-gradient text-primary text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow-soft transition-transform duration-300 ${cartBounce ? 'scale-125 shadow-glow' : ''}`}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <Link 
              href="/login" 
              className="px-5 py-2 rounded-full gold-gradient text-primary font-bold text-xs shadow-soft hover:shadow-glow transition-all"
            >
              Login to Portal
            </Link>
          )}
        </div>
      </div>

    </header>
  )
}
