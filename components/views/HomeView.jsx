'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, ArrowUpRight, Truck, Award, Shield, Zap, TrendingUp, Building2, Sparkles, Grid3x3, Heart, ShoppingBag, Star, PlayCircle, FileText, BatteryCharging, Clock, PackageCheck, AlertCircle, CheckCircle2, RotateCcw, MessageCircle, ChevronRight, ChevronLeft, Lock, ShieldCheck, ShoppingBasket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppContext } from '@/components/providers/AppProvider'
import { ProductCard } from '@/components/ui/ProductCard'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'
import { CatalogAccessPendingCard } from '@/components/ui/CatalogAccessPendingCard'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const catIcon = { 'office-stationery': FileText, 'housekeeping': Sparkles, 'ups-solutions': BatteryCharging, 'grocery': ShoppingBasket }

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

export function HomeView({ initialFeatured, initialCats, initialTrending, initialBanners, initialClients, siteContent = {} }) {
  const { user } = useAppContext()
  const router = useRouter()
  useScrollReveal([initialFeatured, initialCats, initialTrending, initialBanners, initialClients])

  useEffect(() => {
    if (!user) return
    if (user.role === 'customer') {
      router.replace('/customer/dashboard')
    } else if (user.role === 'admin') {
      router.replace('/admin')
    } else if (user.role === 'vendor') {
      router.replace('/vendor')
    }
  }, [user, router])

  if (!user) {
    return <LoggedOutHomeView initialClients={initialClients || []} siteContent={siteContent} />
  }

  if (user.role === 'customer') {
    return null
  }

  const now = new Date()
  const activeBanners = (initialBanners || []).filter(b => {
    if (b.start_date && new Date(b.start_date) > now) return false
    if (b.end_date && new Date(b.end_date) < now) return false
    return true
  })

  const categoriesList = initialCats && initialCats.length >= 3 ? initialCats : [
    {
      id: 'cat-stationery',
      name: 'Office Stationery',
      slug: 'office-stationery',
      description: 'Pens, files, notebooks, office devices & more',
      image_url: '/category-stationery.jpg'
    },
    {
      id: 'cat-housekeeping',
      name: 'Housekeeping Supplies',
      slug: 'housekeeping',
      description: 'Cleaning chemicals, garbage bags, tissues & floor tools',
      image_url: '/category-housekeeping.jpg'
    },
    {
      id: 'cat-ups',
      name: 'UPS & Power Solutions',
      slug: 'ups-solutions',
      description: 'UPS systems, backup batteries & industrial supplies',
      image_url: '/category-ups.jpg'
    },
    {
      id: 'cat-grocery',
      name: 'Grocery',
      slug: 'grocery',
      description: 'Daily groceries, pantry supplies & office kitchen essentials',
      image_url: '/category-grocery.jpg'
    }
  ]

  return (
    <div>
      <HeroSection banners={activeBanners} router={router} />

      {/* Quick Category Bar */}
      <section className="bg-background border-b border-border/40 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex justify-center flex-wrap gap-8 md:gap-16 text-center">
            {[
              { name: 'Office Stationery', slug: 'office-stationery', icon: FileText },
              { name: 'Housekeeping', slug: 'housekeeping', icon: Sparkles },
              { name: 'UPS Solutions', slug: 'ups-solutions', icon: BatteryCharging },
              { name: 'Grocery', slug: 'grocery', icon: ShoppingBasket },
              { name: 'All Products', slug: '', icon: Grid3x3 }
            ].map((cat, i) => {
              const Icon = cat.icon
              return (
                <button
                  key={i}
                  onClick={() => router.push(cat.slug ? '/products?category=' + cat.slug : '/products')}
                  className="group flex flex-col items-center gap-2 focus:outline-none transition reveal-scale"
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-border/80 bg-secondary/30 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-sm group-hover:shadow-glow">
                    <Icon className="w-6 h-6 md:w-8 md:h-8 text-foreground group-hover:text-primary-foreground group-hover:rotate-6 transition-all duration-300" />
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground py-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          {[
            [Truck, 'Pan-India Delivery', 'Same-day dispatch'],
            [Award, 'Premium Quality', 'Verified brands'],
            [Shield, 'GST Invoice', 'B2B compliant'],
            [Zap, '2 Hour Quotes', 'For bulk orders']
          ].map(([I, t, s], i) => (
            <div key={i} className="flex items-center gap-3 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <I className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t}</p>
                <p className="text-xs text-primary-foreground/60">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-24">
        <div className="max-w-2xl mb-12 reveal">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Categories</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold mb-4 text-balance">Everything your <span className="gold-shine">business</span> needs</h2>
          <p className="text-muted-foreground text-lg">Four curated collections. Hundreds of products. One trusted supplier.</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {categoriesList.map((c, i) => {
            const Icon = catIcon[c.slug] || Grid3x3
            return (
              <button key={c.id} onClick={() => router.push('/products?category=' + c.slug)} className="group relative aspect-[4/5] radius-xl overflow-hidden shadow-soft hover:shadow-elevated transition-all duration-500 reveal-scale" style={{ transitionDelay: `${i * 100}ms` }}>
                <Image src={c.image_url} alt={c.name} fill className="object-cover product-card-img group-hover:scale-105 transition-transform duration-500" loading="lazy" sizes="(max-width: 768px) 100vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end text-left text-white">
                  <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-glow"><Icon className="w-7 h-7 text-primary" /></div>
                  <h3 className="font-display text-3xl font-extrabold mb-2">{c.name}</h3>
                  <p className="text-sm text-white/80 mb-4">{c.description}</p>
                  <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm group-hover:gap-3 transition-all">Explore collection <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" /></span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <Section title="Bestsellers" eyebrow="Most loved" sub="What businesses order most this month" products={initialTrending} />

      <FeaturedSection products={initialFeatured} router={router} />

      {initialClients.length > 0 && (
        <section className="py-20 mesh-dark text-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-10 reveal">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Trusted Since 2020</p>
              <h2 className="font-display text-4xl md:text-6xl font-extrabold">Our <span className="gold-shine">valued</span> clients</h2>
            </div>
            <div className="marquee-wrap overflow-hidden">
              <div className="flex whitespace-nowrap w-max marquee">
                {[...initialClients, ...initialClients].map((c, i) => (
                  <div key={i} className="mx-4 inline-flex items-center gap-4 glass-dark radius-lg px-8 py-6">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-10 max-w-[120px] object-contain" />
                    ) : (
                      <div className="w-12 h-12 gold-gradient rounded-xl flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <span className="font-display font-extrabold text-xl">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-24">
        <div className="max-w-2xl mb-12 reveal">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Why AK Enterprises</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-balance">Built for <span className="gold-shine">bulk buyers</span>.<br />Trusted by leaders.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            [Award, 'Premium Quality', 'Only trusted brands & original products, verified by our team.'],
            [TrendingUp, 'Wholesale Pricing', 'Best B2B rates for corporate purchase orders.'],
            [Truck, 'Timely Delivery', 'Same-day dispatch in Maharashtra, next-day pan-India.'],
            [Shield, 'Dedicated Support', 'Personal account manager for every corporate client.'],
            [Building2, '5+ Years B2B', 'Serving finance, insurance & IT companies since 2020.'],
            [Sparkles, '300+ SKUs', 'Wide catalog across stationery, housekeeping & UPS.']
          ].map(([I, t, d], i) => (
            <div key={i} className="reveal group" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <div className="h-full p-8 bg-card radius-xl shadow-soft hover:shadow-elevated card-lift transition-all">
                <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-5 group-hover:rotate-6 transition-transform float" style={{ animationDelay: `${i * 0.3}s` }}><I className="w-6 h-6 text-primary" /></div>
                <h3 className="font-display text-xl font-extrabold mb-2">{t}</h3><p className="text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 md:px-6 pb-24">
        <div className="max-w-7xl mx-auto mesh-hero radius-2xl p-10 md:p-16 relative overflow-hidden grain reveal-scale">
          <div className="max-w-2xl relative z-10">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/40 backdrop-blur">{siteContent.featured_banner_badge?.value || 'Limited Time'}</Badge>
            <h3 className="font-display text-4xl md:text-6xl font-extrabold text-primary-foreground mb-4 text-balance">{siteContent.featured_banner_title?.value || 'Bulk orders? Custom quotes in 2 hours.'}</h3>
            <p className="text-primary-foreground/80 text-lg mb-8">{siteContent.featured_banner_text?.value || 'Corporate purchase for 100+ units? WhatsApp us or use our contact form.'}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <Button size="lg" className="rounded-full px-8 h-12 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-semibold shadow-glow">{siteContent.featured_banner_btn1?.value || 'Request Bulk Quote'} <ArrowRight className="ml-2 w-4 h-4" /></Button>
              </Link>
              <Link href="/products">
                <Button size="lg" variant="outline" className="rounded-full px-8 h-12 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">{siteContent.featured_banner_btn2?.value || 'View Catalog'}</Button>
              </Link>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
        </div>
      </section>

      <RecentlyViewed />
      <Newsletter />
    </div>
  )
}

function CountdownTimer({ endDate }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculate = () => {
      const difference = +new Date(endDate) - +new Date()
      if (difference <= 0) {
        setTimeLeft('Promotion Ended')
        return
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      let parts = []
      if (days > 0) parts.push(`${days}d`)
      parts.push(`${hours}h`)
      parts.push(`${minutes}m`)
      parts.push(`${seconds}s`)
      setTimeLeft(parts.join(' : '))
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  return (
    <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/40 rounded-xl px-4 py-2 mt-2 text-xs font-bold text-accent animate-pulse font-mono tracking-widest shadow-glow">
      ⏳ Sale Ends In: {timeLeft}
    </div>
  )
}

function HeroSection({ banners, router }) {
  const [heroIdx, setHeroIdx] = useState(0)
  const heroRef = useRef(null)
  
  useEffect(() => { 
    if (!banners || banners.length < 2) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % banners.length), 6500)
    return () => clearInterval(t) 
  }, [banners])
  
  useEffect(() => {
    const el = heroRef.current; if (!el) return
    const on = e => { 
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px')
      el.style.setProperty('--my', (e.clientY - r.top) + 'px') 
    }
    el.addEventListener('mousemove', on)
    return () => el.removeEventListener('mousemove', on)
  }, [])

  if (!banners || banners.length === 0) return null

  return (
    <section ref={heroRef} className="relative h-[85vh] min-h-[600px] overflow-hidden grain spotlight">
      {banners.map((s, i) => (
        <div key={s.id || i} className={`absolute inset-0 transition-opacity duration-[1200ms] ${i === heroIdx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Image src={s.image_url} alt="" fill className="object-cover" loading={i === 0 ? 'eager' : 'lazy'} priority={i === 0} sizes="100vw" style={{ transform: i === heroIdx ? 'scale(1)' : 'scale(1.08)', transition: 'transform 8s ease-out' }} />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/70 to-primary/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          <div className="relative max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center">
            <div className="max-w-3xl text-primary-foreground">
              {i === heroIdx && <>
                <div className="inline-flex items-center gap-2 glass-dark border border-accent/30 rounded-full px-4 py-2 mb-6 fade-in" style={{ animationDelay: '0.2s' }}><Award className="w-4 h-4 text-accent" /><span className="text-xs uppercase tracking-[0.15em] font-semibold text-accent">Est. 2020 — Pune</span></div>
                <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 text-balance leading-[0.95]">
                  {s.title?.split(' ').map((word, wi) => (
                    <span key={wi} className="letter-reveal mr-4">
                      <span style={{ animationDelay: `${0.3 + wi * 0.08}s` }}>{wi === 0 ? <span className="gold-shine">{word}</span> : word}</span>
                    </span>
                  ))}
                </h1>
                <p className="text-lg md:text-xl mb-6 text-primary-foreground/85 max-w-xl fade-in" style={{ animationDelay: '0.8s' }}>{s.subtitle}</p>
                {s.show_countdown && s.end_date && (
                  <div className="mb-6 fade-in" style={{ animationDelay: '0.9s' }}>
                    <CountdownTimer endDate={s.end_date} />
                  </div>
                )}
                <div className="flex flex-wrap gap-3 fade-in" style={{ animationDelay: '1s' }}>
                  <Link href={s.cta_link || '/products'}>
                    <Button size="lg" className="rounded-full px-8 h-14 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-bold text-base shadow-glow">{s.cta_text || 'Shop Now'} <ArrowRight className="ml-2 w-4 h-4" /></Button>
                  </Link>
                  <Link href="/contact">
                    <Button size="lg" variant="outline" className="rounded-full px-8 h-14 border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent text-base">Request Quote</Button>
                  </Link>
                </div>
              </>}
            </div>
          </div>
        </div>
      ))}
      {banners.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setHeroIdx(i)} className={`h-1.5 rounded-full transition-all ${i === heroIdx ? 'w-10 bg-accent' : 'w-2 bg-white/40 hover:bg-white/60'}`} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      )}
    </section>
  )
}

function Section({ title, eyebrow, sub, products }) {
  if (!products || products.length === 0) return null
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between mb-10 reveal">
          <div className="max-w-2xl">
            {eyebrow && <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— {eyebrow}</p>}
            <h2 className="font-display text-4xl md:text-6xl font-extrabold text-balance">{title}</h2>
            {sub && <p className="text-muted-foreground text-lg mt-3">{sub}</p>}
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-1 hover:text-primary transition group font-medium">
            View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, 8).map((p, i) => (
            <div key={p.id} className="reveal" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturedSection({ products, router }) {
  if (!products || products.length === 0) return null
  const hero = products[0]; const rest = products.slice(1, 5)
  return (
    <section className="py-24 mesh-warm relative overflow-hidden">
      <div className="blob w-96 h-96 bg-accent/30 top-10 -left-20" />
      <div className="blob w-80 h-80 bg-primary/20 bottom-10 right-0" style={{ animationDelay: '4s' }} />
      <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
        <div className="max-w-2xl mb-10 reveal">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Editor's picks</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-balance">Featured <span className="gold-shine">deals</span></h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="reveal">
            <Link href={'/product/' + hero.slug} className="group relative aspect-[4/5] md:aspect-auto md:h-full w-full radius-xl overflow-hidden shadow-soft hover:shadow-elevated transition-all block text-left">
              <Image src={hero.images?.[0]} alt={hero.name} fill className="object-cover product-card-img" loading="lazy" sizes="(max-width: 768px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {hero.discount_percent > 0 && <div className="absolute top-6 left-6 gold-gradient text-primary rounded-full px-4 py-1.5 text-sm font-extrabold shadow-glow">{hero.discount_percent}% OFF</div>}
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">Featured</p>
                <h3 className="font-display text-3xl md:text-4xl font-extrabold mb-3 text-balance">{hero.name}</h3>
                <div className="flex items-baseline gap-3 mb-4"><span className="text-2xl font-bold">{formatINR(hero.price)}</span></div>
                <span className="inline-flex items-center gap-2 text-accent font-semibold group-hover:gap-3 transition-all">Shop now <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" /></span>
              </div>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            {rest.map((p, i) => (
              <div key={p.id} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const submit = async e => { 
    e.preventDefault()
    try { 
      await fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' } })
      setDone(true)
      toast.success('Subscribed!') 
    } catch { 
      toast.error('Failed') 
    } 
  }
  return (
    <section className="max-w-3xl mx-auto text-center py-24 px-4 reveal">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— Stay in the loop</p>
      <h3 className="font-display text-4xl md:text-6xl font-extrabold mb-4 text-balance">Exclusive <span className="gold-shine">B2B</span> deals</h3>
      <p className="text-muted-foreground text-lg mb-8">Join our mailing list for wholesale offers, new products & bulk discounts.</p>
      {done ? <p className="text-accent font-bold text-xl">Thanks for subscribing ✨</p> :
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="your.business@company.com" className="flex-1 rounded-full px-6 h-12 shadow-soft" />
          <Button type="submit" onClick={addRipple} className="rounded-full px-8 h-12 btn-shine ripple font-semibold">Subscribe</Button>
        </form>}
    </section>
  )
}

function HeroSlider({ whatsappUrl }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const slides = [
    {
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1600&auto=format&fit=crop',
      badge: '🔒 Private B2B Procurement Portal',
      title: <>Corporate Supply & Procurement for <span className="gold-shine">Leading Enterprises</span></>,
      subtext: 'AK Enterprises is an invite-only B2B ordering portal. We provide contract-based wholesale pricing, itemized GST invoices, and dedicated logistics for corporate partners.'
    },
    {
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop',
      badge: '🚚 Pan-India Bulk Delivery & Contract Pricing',
      title: <>Premium Office & Stationery Solutions for <span className="gold-shine">Corporate Hubs</span></>,
      subtext: 'Streamline your monthly corporate supply chain with guaranteed SLA fulfillment, automated invoicing, and dedicated account management.'
    },
    {
      image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1600&auto=format&fit=crop',
      badge: '✨ Commercial Grade Housekeeping & Cleaning',
      title: <>Bulk Industrial Housekeeping & Facility <span className="gold-shine">Sanitation Supplies</span></>,
      subtext: 'High-performance chemical concentrates, janitorial equipment, and paper products at wholesale contracted rates for facilities and campuses.'
    },
    {
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1600&auto=format&fit=crop',
      badge: '⚡ Commercial UPS & Power Equipment',
      title: <>Heavy Duty Industrial Power Backup & <span className="gold-shine">UPS Systems</span></>,
      subtext: 'Ensure zero downtime for data centers, offices, and manufacturing units with certified power infrastructure and direct enterprise support.'
    }
  ]

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [isPaused, slides.length])

  const nextSlide = () => setCurrentSlide((currentSlide + 1) % slides.length)
  const prevSlide = () => setCurrentSlide((currentSlide - 1 + slides.length) % slides.length)

  return (
    <section 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative min-h-[78vh] sm:min-h-[82vh] flex items-center justify-center text-white px-4 py-16 overflow-hidden select-none"
    >
      {/* Background Image Slides */}
      {slides.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={slide.image}
            alt="Hero B2B Procurement"
            className="w-full h-full object-cover transform scale-105 transition-transform duration-10000"
          />
          {/* Heavy Dark Overlay for Maximum Contrast & Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/60" />
          <div className="absolute inset-0 mesh-dark opacity-60 mix-blend-overlay" />
        </div>
      ))}

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto text-center relative z-20 px-2 sm:px-4 py-8">
        <Badge className="mb-6 bg-amber-400/20 text-amber-300 border-amber-400/40 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest backdrop-blur-md inline-flex items-center gap-1.5 shadow-lg">
          {slides[currentSlide].badge}
        </Badge>

        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight text-balance text-white drop-shadow-md">
          {slides[currentSlide].title}
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-3xl mx-auto mb-10 leading-relaxed font-medium drop-shadow-sm">
          {slides[currentSlide].subtext}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full px-8 h-14 gold-gradient text-primary hover:opacity-95 font-extrabold text-base shadow-glow">
              Login to Account <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>

          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto rounded-full px-8 h-14 border-2 border-amber-400/80 text-amber-300 hover:text-white bg-black/50 hover:bg-amber-500/20 font-extrabold text-base backdrop-blur-md transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer">
              <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              Contact Procurement Team
            </button>
          </a>
        </div>

        {/* Pricing Notice */}
        <div className="mt-8 p-3 bg-white/10 border border-white/15 rounded-2xl inline-block text-xs text-white/80 backdrop-blur-xs font-medium">
          🔒 Prices and product catalog are visible only to verified logged-in corporate partners.
        </div>
      </div>

      {/* Slider Left Arrow */}
      <button
        onClick={prevSlide}
        aria-label="Previous Slide"
        className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/40 hover:bg-amber-500/30 text-white border border-white/20 hover:border-amber-400/60 backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 shadow-2xl cursor-pointer"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Slider Right Arrow */}
      <button
        onClick={nextSlide}
        aria-label="Next Slide"
        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/40 hover:bg-amber-500/30 text-white border border-white/20 hover:border-amber-400/60 backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 shadow-2xl cursor-pointer"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Slider Pagination Dots (Flipkart Style) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/15">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              idx === currentSlide
                ? 'w-7 h-2.5 bg-gradient-to-r from-amber-300 to-amber-500 shadow-glow'
                : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function LoggedOutHomeView({ initialClients, siteContent = {} }) {
  const heroBadge = siteContent.hero_badge?.value || 'Est. 2020 — Pune, India'
  const heroTitle = siteContent.hero_title?.value || 'Your Trusted'
  const heroAccent = siteContent.hero_title_accent?.value || 'B2B Partner'
  const heroSubtitle = siteContent.hero_subtitle?.value || 'Office Stationery · Housekeeping · UPS Solutions'
  const heroImage = siteContent.hero_image?.value || '/category-stationery.jpg'

  const DEFAULT_CLIENTS = [{name:'ICICI Lombard'},{name:'Equitas'},{name:'InCred'},{name:'JM Finance'},{name:'Axis Bank'},{name:'HDFC'},{name:'Bajaj Finserv'},{name:'Tata Capital'},{name:'Aditya Birla'}]
  let clientsBase = DEFAULT_CLIENTS
  if (siteContent.clients_list?.value) {
    try { const parsed = JSON.parse(siteContent.clients_list.value); if (parsed.length) clientsBase = parsed } catch {}
  }
  if (clientsBase === DEFAULT_CLIENTS && initialClients && initialClients.length > 0) {
    clientsBase = initialClients
  }
  const marqueeClients = [...clientsBase, ...clientsBase]

  return (
    <div>
      {/* ───── 1. HERO SECTION ───── */}
      <section className="relative h-[92vh] min-h-[700px] overflow-hidden bg-[#120606]">
        <div className="absolute inset-0">
          <Image src={heroImage} alt="" fill className="object-cover opacity-60" priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#120606]/98 via-[#1a0a0a]/90 to-[#2a1212]/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120606]/90 via-transparent to-transparent" />
        </div>
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center">
          <div className="max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="inline-flex items-center gap-3 glass-dark border border-accent/15 rounded-full px-5 py-2 mb-8">
                <Award className="w-4 h-4 text-accent" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">{heroBadge}</span>
              </div>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold text-white mb-6 leading-[0.92] tracking-[-0.04em]">
              {heroTitle}<br />
              <span className="gold-shine">{heroAccent}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-lg md:text-xl lg:text-2xl text-white/70 max-w-2xl mb-10 font-light tracking-wide">
              {heroSubtitle}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="flex flex-wrap gap-4">
              <Link href="/products">
                <Button size="lg" className="rounded-full px-10 h-16 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-bold text-base shadow-glow text-lg">
                  Browse Catalog <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="rounded-full px-10 h-16 border-white/25 text-white hover:bg-white/10 hover:text-white bg-transparent text-lg">
                  Request Quote
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 rounded-full border-2 border-white/15 flex items-start justify-center p-1.5">
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} className="w-1.5 h-1.5 rounded-full bg-accent" />
          </div>
        </motion.div>
      </section>

      {/* ───── 2. FEATURE STRIP ───── */}
      <section className="bg-[#120606] border-y border-white/[0.03] py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              [Truck, siteContent.highlight_1_title?.value || 'Pan India Delivery', siteContent.highlight_1_desc?.value || 'Same-day dispatch across Maharashtra'],
              [Award, siteContent.highlight_2_title?.value || 'Premium Quality', siteContent.highlight_2_desc?.value || 'Only verified & trusted brands'],
              [Shield, siteContent.highlight_3_title?.value || 'GST Invoice', siteContent.highlight_3_desc?.value || '100% B2B tax compliance on every order'],
              [Zap, siteContent.highlight_4_title?.value || '2 Hour Quotes', siteContent.highlight_4_desc?.value || 'Rapid response for bulk & corporate orders']
            ].map(([I, t, d], i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}>
                <div className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-accent/20 transition-all duration-300 group">
                  <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <I className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white">{t}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">{d}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 3. CATEGORIES SECTION ───── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-4">— {siteContent.cat_eyebrow?.value || 'Our Categories'}</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-foreground mb-4 text-balance">
            {siteContent.cat_heading?.value || 'Everything your'} <span className="gold-shine">{siteContent.cat_heading_accent?.value || 'business'}</span> needs
          </h2>
          <p className="text-muted-foreground text-lg">{siteContent.cat_subtitle?.value || 'Complete B2B supply solutions across three core verticals. One trusted partner.'}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: siteContent.cat_1_name?.value || 'Office Stationery', slug: siteContent.cat_1_slug?.value || 'office-stationery', img: siteContent.cat_1_image?.value || '/category-stationery.jpg', desc: siteContent.cat_1_desc?.value || 'Pens, files, notebooks, printing supplies & desk accessories for corporates.' },
            { name: siteContent.cat_2_name?.value || 'Housekeeping', slug: siteContent.cat_2_slug?.value || 'housekeeping', img: siteContent.cat_2_image?.value || '/category-housekeeping.jpg', desc: siteContent.cat_2_desc?.value || 'Cleaning chemicals, garbage bags, tissue rolls & janitorial essentials.' },
            { name: siteContent.cat_3_name?.value || 'UPS Solutions', slug: siteContent.cat_3_slug?.value || 'ups-solutions', img: siteContent.cat_3_image?.value || '/category-ups.jpg', desc: siteContent.cat_3_desc?.value || 'Industrial UPS, backup batteries, surge protectors & power infrastructure.' }
          ].map((cat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.6 }}>
              <Link href={'/products?category=' + cat.slug} className="group relative block aspect-[4/5] radius-xl overflow-hidden shadow-soft hover:shadow-elevated transition-all duration-500">
                <Image src={cat.img} alt={cat.name} fill className="object-cover product-card-img group-hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#120606] via-[#120606]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <h3 className="font-display text-3xl font-extrabold text-white mb-3">{cat.name}</h3>
                  <p className="text-sm text-white/70 mb-5">{cat.desc}</p>
                  <span className="inline-flex items-center gap-2 text-accent font-bold text-sm group-hover:gap-3 transition-all">
                    {siteContent.cat_card_link_text?.value || 'Explore Collection'} <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                  </span>
                </div>
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-[10px] font-bold text-white uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {siteContent.cat_card_hover_label?.value || 'View Products →'}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───── 4. TRUSTED CLIENTS ───── */}
      <section className="py-24 mesh-dark text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-4">— {siteContent.clients_eyebrow?.value || 'Trusted Since 2020'}</p>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold" dangerouslySetInnerHTML={{ __html: siteContent.clients_heading?.value || 'Our <span class="gold-shine">Valued</span> Clients' }} />
            <p className="text-white/60 text-lg mt-4 max-w-xl mx-auto">{siteContent.clients_subtitle?.value || 'Serving leading enterprises across finance, insurance & corporate sectors.'}</p>
          </motion.div>

          <div className="marquee-wrap overflow-hidden">
            <div className="flex whitespace-nowrap w-max marquee">
              {marqueeClients.map((c, i) => {
                const name = typeof c === 'string' ? c : c?.name || ''
                const logoUrl = typeof c === 'string' ? null : c?.logo_url
                return (
                  <div key={i} className="mx-4 inline-flex items-center gap-4 glass-dark radius-lg px-8 py-5 group hover:border-accent/30 transition-all duration-300">
                    {logoUrl ? (
                      <img src={logoUrl} alt={name} className="h-9 max-w-[130px] object-contain opacity-80 group-hover:opacity-100 transition-all duration-300" />
                    ) : (
                      <div className="w-11 h-11 gold-gradient rounded-xl flex items-center justify-center shrink-0 group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <span className="font-display font-extrabold text-xl text-white/90 group-hover:text-accent transition-colors">{name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───── 5. WHY CHOOSE US ───── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-4">— {siteContent.why_eyebrow?.value || 'Why AK Enterprises'}</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-foreground text-balance">
            {(siteContent.why_heading?.value || 'Built for Bulk Buyers. Trusted by Leaders.').split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
            ))}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            [Award, siteContent.why_1_title?.value || 'Premium Quality', siteContent.why_1_desc?.value || 'Only trusted brands & genuine products — verified by our procurement team.'],
            [TrendingUp, siteContent.why_2_title?.value || 'Wholesale Pricing', siteContent.why_2_desc?.value || 'Best B2B rates with custom corporate rate cards & volume-based discounts.'],
            [Truck, siteContent.why_3_title?.value || 'Timely Delivery', siteContent.why_3_desc?.value || 'Same-day dispatch in Maharashtra, next-day pan-India logistics network.'],
            [Shield, siteContent.why_4_title?.value || 'Dedicated Support', siteContent.why_4_desc?.value || 'Personal account manager assigned to every corporate & bulk buyer.'],
            [Building2, siteContent.stats_b2b_years?.value || '5+ Years B2B', siteContent.stats_b2b_desc?.value || 'Trusted partner for finance, insurance, IT & manufacturing since 2020.'],
            [Sparkles, siteContent.stats_products_count?.value || '300+ Products', siteContent.stats_products_desc?.value || 'Wide catalog spanning office stationery, housekeeping & UPS solutions.']
          ].map(([I, t, d], i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}>
              <div className="h-full p-8 bg-card radius-xl shadow-soft hover:shadow-elevated card-lift transition-all duration-300 border border-border/60 group">
                <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-5 group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                  <I className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-extrabold mb-2 text-foreground">{t}</h3>
                <p className="text-muted-foreground leading-relaxed">{d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───── 6. CTA BANNER ───── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mesh-hero radius-2xl p-10 md:p-16 relative overflow-hidden grain">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -left-20 -top-20 w-60 h-60 rounded-full bg-white/[0.04] blur-3xl" />

          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <Badge className="mb-5 bg-accent/20 text-accent border-accent/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">{siteContent.featured_banner_badge?.value || 'Bulk Ordering'}</Badge>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold text-primary-foreground mb-4 text-balance">
              {siteContent.featured_banner_title?.value || 'Bulk orders? Custom quotes in 2 hours.'}
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg mx-auto">
              {siteContent.featured_banner_text?.value || 'Corporate purchase orders for 100+ units. Get dedicated pricing & priority dispatch.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/contact">
                <Button size="lg" className="rounded-full px-10 h-14 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-bold text-base shadow-glow">
                  {siteContent.featured_banner_btn1?.value || 'Request Bulk Quote'} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/products">
                <Button size="lg" variant="outline" className="rounded-full px-10 h-14 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-bold text-base">
                  {siteContent.featured_banner_btn2?.value || 'View Catalog'}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}

import { useRealtimeOrders, useRealtimePricing, useRealtimeProducts } from '@/lib/hooks/useRealtime'

function LoggedInCustomerHomeView({ user }) {
  const { cart, addToCart } = useAppContext()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [catalogLocked, setCatalogLocked] = useState(false)
  const [assignedProducts, setAssignedProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [moq, setMoq] = useState(6000)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    try {
      const [prodRes, orderRes, moqRes] = await Promise.all([
        fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/moq')
      ])

      if (prodRes.ok) {
        const pData = await prodRes.json()
        if (pData.catalog_locked || !pData.products || pData.products.length === 0) {
          setCatalogLocked(true)
        } else {
          setCatalogLocked(false)
          setAssignedProducts(pData.products)
        }
      } else {
        setCatalogLocked(true)
      }

      if (orderRes.ok) {
        const oData = await orderRes.json()
        setOrders(oData || [])
      }
      if (moqRes.ok) {
        const mData = await moqRes.json()
        if (mData.moq) setMoq(mData.moq)
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeOrders(loadDashboardData)
  useRealtimePricing(loadDashboardData)
  useRealtimeProducts(loadDashboardData)

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // 7. If customer has 0 products assigned, show the WhatsApp Access Request screen
  if (!loading && (catalogLocked || assignedProducts.length === 0)) {
    return <HomeAccessPendingView user={user} />
  }

  // Order status counts
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const confirmedCount = orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length
  const shippedCount = orders.filter(o => o.status === 'shipped' || o.status === 'out_for_delivery').length
  const deliveredCount = orders.filter(o => o.status === 'delivered').length

  // Cart total quantity & MOQ check
  const cartQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0)
  const showMoqReminder = cartQty > 0 && cartQty < moq
  const remainingMoq = Math.max(0, moq - cartQty)

  // Fast reorder items from past orders
  const reorderItemsMap = new Map()
  orders.forEach(o => {
    (o.order_items || []).forEach(item => {
      if (!reorderItemsMap.has(item.product_id)) {
        const matchedAssigned = assignedProducts.find(ap => ap.id === item.product_id)
        if (matchedAssigned) {
          reorderItemsMap.set(item.product_id, matchedAssigned)
        }
      }
    })
  })
  const reorderList = Array.from(reorderItemsMap.values()).slice(0, 6)
  const fastReorderProducts = reorderList.length > 0 ? reorderList : assignedProducts.slice(0, 6)

  const whatsappRequestText = encodeURIComponent(`Hello AK Enterprises, my account is ${user.full_name || user.email} (${user.phone || ''}). I would like to request additional products added to my custom B2B catalog.`)
  const whatsappRequestUrl = `https://wa.me/918308860894?text=${whatsappRequestText}`

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-8">
        <div className="h-44 rounded-3xl skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
      {/* 1. Personalized Welcome Section */}
      <section className="mesh-hero rounded-3xl p-8 md:p-12 text-primary-foreground relative overflow-hidden shadow-elevated text-left">
        <div className="relative z-10 max-w-3xl">
          <Badge className="mb-4 bg-accent/20 text-accent border-accent/40 px-3.5 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur">
            🏢 B2B Corporate Portal
          </Badge>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold mb-4 leading-tight">
            Welcome back, <span className="gold-shine">{user.full_name || user.email}</span>!
          </h1>
          <p className="text-primary-foreground/85 text-base md:text-lg mb-8 max-w-2xl leading-relaxed font-medium">
            Manage your corporate rate sheets, instant reorders, and active shipments with Pan-India B2B fulfillment.
          </p>

          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            <div className="bg-white/10 backdrop-blur border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-accent" />
              <span>{assignedProducts.length} Products Assigned in Your Catalog</span>
            </div>
            <div className="bg-white/10 backdrop-blur border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>{pendingCount + confirmedCount + shippedCount} Orders in Progress</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
      </section>

      {/* 6. MOQ Inline Reminder Banner */}
      {showMoqReminder && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                Minimum Order Quantity (MOQ) Notice
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your cart currently has <strong className="text-foreground">{cartQty}</strong> units. Add <strong className="text-accent">{remainingMoq} more units</strong> to meet the required {moq} MOQ for checkout.
              </p>
            </div>
          </div>
          <Link href="/cart">
            <Button size="sm" className="rounded-full gold-gradient text-primary font-bold text-xs h-9 px-5">
              View Cart & Checkout
            </Button>
          </Link>
        </div>
      )}

      {/* 2. Quick Action Cards */}
      <section className="grid sm:grid-cols-3 gap-6">
        <button
          onClick={() => router.push('/products')}
          className="group bg-card border border-border/80 rounded-2xl p-6 text-left hover:border-accent/50 transition-all duration-300 shadow-soft hover:shadow-glow"
        >
          <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-soft">
            <Grid3x3 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display font-extrabold text-lg text-foreground mb-1 group-hover:text-accent transition-colors flex items-center justify-between">
            Browse My Products <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Access your custom rate card and assigned wholesale pricing.
          </p>
        </button>

        <button
          onClick={() => router.push('/orders')}
          className="group bg-card border border-border/80 rounded-2xl p-6 text-left hover:border-accent/50 transition-all duration-300 shadow-soft hover:shadow-glow"
        >
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6 text-accent" />
          </div>
          <h3 className="font-display font-extrabold text-lg text-foreground mb-1 group-hover:text-accent transition-colors flex items-center justify-between">
            Track My Orders <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Check active shipment status, invoices, and reorder history.
          </p>
        </button>

        <a
          href={whatsappRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-card border border-border/80 rounded-2xl p-6 text-left hover:border-emerald-500/50 transition-all duration-300 shadow-soft hover:shadow-glow"
        >
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-display font-extrabold text-lg text-foreground mb-1 group-hover:text-emerald-600 transition-colors flex items-center justify-between">
            Request More Products <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Request additional products added to your custom B2B rate card.
          </p>
        </a>
      </section>

      {/* 5. Order Status Summary Widget */}
      <section className="bg-card border border-border/70 rounded-3xl p-6 shadow-sm text-left">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
          <div>
            <h3 className="font-display font-extrabold text-xl text-foreground">Order Status Summary</h3>
            <p className="text-xs text-muted-foreground">Click any card to filter your orders page by status</p>
          </div>
          <Link href="/orders" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
            View All Orders ({orders.length}) <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending Approval', count: pendingCount, icon: Clock, status: 'pending', color: 'text-amber-500 bg-amber-500/10' },
            { label: 'Confirmed / Active', count: confirmedCount, icon: PackageCheck, status: 'confirmed', color: 'text-blue-500 bg-blue-500/10' },
            { label: 'Shipped & En Route', count: shippedCount, icon: Truck, status: 'shipped', color: 'text-purple-500 bg-purple-500/10' },
            { label: 'Delivered Orders', count: deliveredCount, icon: CheckCircle2, status: 'delivered', color: 'text-emerald-500 bg-emerald-500/10' }
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                onClick={() => router.push(`/orders?status=${item.status}`)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border/60 bg-secondary/20 hover:bg-secondary/60 hover:border-accent/40 transition text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-display font-extrabold text-foreground">{item.count}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">{item.label}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* 3. Fast Reorder Section */}
      {fastReorderProducts.length > 0 && (
        <section className="space-y-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-accent mb-1">— Repeat Ordering</p>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-foreground">
                Reorder B2B Essentials
              </h2>
            </div>
            <Link href="/products" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
              View Catalog <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {fastReorderProducts.map(p => (
              <div key={p.id} className="w-64 shrink-0 bg-card border border-border/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary mb-3">
                    <Image src={p.images?.[0] || p.image_url || '/placeholder.png'} alt={p.name} fill className="object-cover" />
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase font-bold text-accent mb-1.5">
                    Contract Rate
                  </Badge>
                  <h4 className="font-display font-extrabold text-sm text-foreground line-clamp-2 mb-1">{p.name}</h4>
                  <div className="font-mono font-extrabold text-base text-primary mb-3">
                    {formatINR(p.price)}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={e => { addRipple(e); addToCart(p, 1); }}
                  className="w-full rounded-xl gold-gradient text-primary font-bold text-xs h-9"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Quick Reorder
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Assigned Products Preview Strip */}
      <section className="space-y-6 text-left">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-accent mb-1">— Your Rate Card</p>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-foreground">
              Your Available Products
            </h2>
          </div>
          <Link href="/products">
            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4 border-border">
              View All ({assignedProducts.length}) <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {assignedProducts.slice(0, 8).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}

function CatalogAccessPendingView({ user }) {
  return <CatalogAccessPendingCard user={user} />
}

function HomeAccessPendingView({ user }) {
  return <CatalogAccessPendingCard user={user} />
}


