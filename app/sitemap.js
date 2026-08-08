import { createClient } from '@supabase/supabase-js'

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://akcorporateworld.com'

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )

    // Static pages
    const staticPages = [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
      { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
      { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${baseUrl}/bulk-quote`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ]

    // Product pages
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)

    const productPages = (products || []).map(p => ({
      url: `${baseUrl}/product/${p.slug}`,
      lastModified: new Date(p.updated_at || Date.now()),
      changeFrequency: 'weekly',
      priority: 0.8
    }))

    // Category pages
    const { data: categories } = await supabase.from('categories').select('slug')
    const categoryPages = (categories || []).map(c => ({
      url: `${baseUrl}/products?category=${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7
    }))

    return [...staticPages, ...productPages, ...categoryPages]
  } catch (e) {
    console.error('Sitemap generation error:', e)
    return [{ url: baseUrl, lastModified: new Date() }]
  }
}
