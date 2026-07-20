'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, ArrowUpRight, Truck, Award, Shield, Zap, TrendingUp, Building2, Sparkles, Grid3x3, Heart, ShoppingBag, Star, PlayCircle, FileText, BatteryCharging } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppContext } from '@/components/providers/AppProvider'
import { ProductCard } from '@/components/ui/ProductCard'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const catIcon = { 'office-stationery': FileText, 'housekeeping': Sparkles, 'ups-solutions': BatteryCharging }

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

export function HomeView({ initialFeatured, initialCats, initialTrending, initialBanners, initialClients }) {
  const router = useRouter()
  useScrollReveal([initialFeatured, initialCats, initialTrending, initialBanners, initialClients])

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
      image_url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-housekeeping',
      name: 'Housekeeping Supplies',
      slug: 'housekeeping',
      description: 'Cleaning chemicals, garbage bags, tissues & floor tools',
      image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-ups',
      name: 'UPS & Power Solutions',
      slug: 'ups-solutions',
      description: 'UPS systems, backup batteries & industrial supplies',
      image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80'
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
          <p className="text-muted-foreground text-lg">Three curated collections. Hundreds of products. One trusted supplier.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
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
              <div className="flex whitespace-nowrap marquee">
                {[...initialClients, ...initialClients, ...initialClients].map((c, i) => (
                  <div key={i} className="mx-4 inline-flex items-center gap-4 glass-dark radius-lg px-8 py-6">
                    <div className="w-12 h-12 gold-gradient rounded-xl flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
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
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/40 backdrop-blur">Limited Time</Badge>
            <h3 className="font-display text-4xl md:text-6xl font-extrabold text-primary-foreground mb-4 text-balance">Bulk orders? Custom quotes in 2 hours.</h3>
            <p className="text-primary-foreground/80 text-lg mb-8">Corporate purchase for 100+ units? WhatsApp us or use our contact form.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <Button size="lg" className="rounded-full px-8 h-12 bg-accent text-accent-foreground hover:bg-accent/90 btn-shine ripple font-semibold shadow-glow">Request Bulk Quote <ArrowRight className="ml-2 w-4 h-4" /></Button>
              </Link>
              <Link href="/products">
                <Button size="lg" variant="outline" className="rounded-full px-8 h-12 border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">View Catalog</Button>
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
                <div className="flex items-baseline gap-3 mb-4"><span className="text-2xl font-bold">{formatINR(hero.price)}</span>{hero.mrp > hero.price && <span className="text-sm text-white/60 line-through">{formatINR(hero.mrp)}</span>}</div>
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


