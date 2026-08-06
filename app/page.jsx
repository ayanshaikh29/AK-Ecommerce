import { getSupabase, getSiteContent } from '@/lib/supabase'
import { HomeView } from '@/components/views/HomeView'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = getSupabase()

  // Fetch required data in parallel on the server
  const [
    { data: featured },
    { data: cats },
    { data: trending },
    { data: banners },
    { data: clients },
    siteContent
  ] = await Promise.all([
    supabase.from('products').select('*, product_images(image_url)').eq('is_featured', true).limit(8),
    supabase.from('categories').select('*'),
    supabase.from('products').select('*, product_images(image_url)').order('rating_count', { ascending: false }).limit(8),
    supabase.from('banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('clients').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    getSiteContent('homepage')
  ])

  const mapProducts = list => (list || []).map(p => ({
    ...p,
    images: p.product_images?.map(img => img.image_url) || []
  }))

  return (
    <HomeView
      initialFeatured={mapProducts(featured)}
      initialCats={cats || []}
      initialTrending={mapProducts(trending)}
      initialBanners={banners || []}
      initialClients={clients || []}
      siteContent={siteContent}
    />
  )
}
