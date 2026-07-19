'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid3X3, ShoppingBag, Heart, User } from 'lucide-react'
import { useAppContext } from '@/components/providers/AppProvider'

export function MobileBottomNav() {
  const { cartCount, user } = useAppContext()
  const pathname = usePathname()

  // Hide on admin pages
  if (pathname?.startsWith('/admin')) return null

  const tabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/products', icon: Grid3X3, label: 'Shop' },
    { href: '/cart', icon: ShoppingBag, label: 'Cart', badge: cartCount },
    { href: '/wishlist', icon: Heart, label: 'Wishlist' },
    { href: user ? '/account' : '/login', icon: User, label: user ? 'Account' : 'Sign In' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-stretch" style={{ height: '60px' }}>
        {tabs.map(tab => {
          const isActive = tab.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors py-2 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <tab.icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 gold-gradient text-primary text-[9px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold leading-none ${isActive ? 'text-primary' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
      {/* iOS safe area */}
      <div className="h-safe-area-inset-bottom bg-background" />
    </nav>
  )
}
