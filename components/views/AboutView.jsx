'use client'
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Award, TrendingUp, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function useScrollReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' })
    document.querySelectorAll('.reveal:not(.in-view), .reveal-scale:not(.in-view)').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, deps)
}

export function AboutView({ settings = {}, siteContent = {} }) {
  const router = useRouter()
  useScrollReveal([])
  
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
      <div className="text-center mb-16 slide-up">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">— About Us</p>
        <h1 className="font-display text-5xl md:text-7xl font-extrabold mb-4 text-balance">{settings.brand_name || 'AK Enterprises'}</h1>
        {siteContent.about_body?.value ? (
          <div className="text-muted-foreground max-w-3xl mx-auto text-base leading-relaxed prose prose-sm dark:prose-invert mt-6 text-center" dangerouslySetInnerHTML={{ __html: siteContent.about_body.value }} />
        ) : (
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Your trusted partner for office stationery, housekeeping solutions & UPS supply. Established in {settings.year_established || '2020'}, serving businesses pan-India from Pune.
          </p>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-16">
        <div className="p-8 radius-xl bg-card shadow-soft card-lift reveal">
          <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-5 float">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display text-2xl font-extrabold mb-3">Our Mission</h3>
          {siteContent.mission?.value ? (
            <div className="text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: siteContent.mission.value }} />
          ) : (
            <p className="text-muted-foreground">To provide high-quality products and dependable services that help businesses maintain efficient, clean, and productive workplaces.</p>
          )}
        </div>
        <div className="p-8 radius-xl bg-card shadow-soft card-lift reveal" style={{ transitionDelay: '100ms' }}>
          <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-5 float" style={{ animationDelay: '0.5s' }}>
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display text-2xl font-extrabold mb-3">Our Vision</h3>
          {siteContent.vision?.value ? (
            <div className="text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: siteContent.vision.value }} />
          ) : (
            <p className="text-muted-foreground">To become one of India's most trusted suppliers of office essentials and facility support products.</p>
          )}
        </div>
      </div>
      <div className="mesh-hero radius-2xl p-10 md:p-16 text-primary-foreground grain relative overflow-hidden reveal-scale">
        <h3 className="font-display text-3xl font-extrabold mb-8 text-center">{siteContent.company_info_title?.value || 'Company Info'}</h3>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <p className="font-display text-6xl font-extrabold gold-shine">{siteContent.established_year?.value || settings.year_established || '2020'}</p>
            <p className="text-primary-foreground/70 mt-2">Established</p>
          </div>
          <div>
            <p className="font-display text-6xl font-extrabold gold-shine">{siteContent.team_members_count?.value || '7+'}</p>
            <p className="text-primary-foreground/70 mt-2">Team Members</p>
          </div>
          <div>
            <p className="font-display text-6xl font-extrabold gold-shine">{siteContent.happy_clients_count?.value || '500+'}</p>
            <p className="text-primary-foreground/70 mt-2">Happy Clients</p>
          </div>
        </div>
      </div>
      <div className="text-center mt-12">
        <Button onClick={() => router.push('/contact')} size="lg" className="rounded-full btn-shine px-8">
          Get in Touch <ArrowRight className="ml-1 w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
