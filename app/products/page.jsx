import { getSupabase } from '@/lib/supabase'
import { ProductsView } from '@/components/views/ProductsView'

export default async function ProductsPage({ searchParams }) {
  const supabase = getSupabase()
  
  // Need to await searchParams in Next.js 15
  const categorySlug = searchParams?.category || ''
  const search = searchParams?.search || ''
  const featured = searchParams?.featured === '1'
  const sort = searchParams?.sort || 'newest'
  const minPrice = searchParams?.minPrice ? parseInt(searchParams.minPrice) : 0
  const maxPrice = searchParams?.maxPrice ? parseInt(searchParams.maxPrice) : 15000

  // Parallel fetching
  const [{ data: cats }, { data: allProducts }] = await Promise.all([
    supabase.from('categories').select('*'),
    (async () => {
      let query = supabase.from('products').select('*, product_images(image_url)')
      
      if (categorySlug) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle()
        if (cat) query = query.eq('category_id', cat.id)
      }
      if (search) query = query.ilike('name', `%${search}%`)
      if (featured) query = query.eq('is_featured', true)
      if (minPrice) query = query.gte('price', minPrice)
      if (maxPrice) query = query.lte('price', maxPrice)
      
      if (sort === 'price-asc') query = query.order('price', { ascending: true })
      else if (sort === 'price-desc') query = query.order('price', { ascending: false })
      else if (sort === 'popular') query = query.order('rating_count', { ascending: false })
      else query = query.order('created_at', { ascending: false })
      
      return query
    })()
  ])

  const mappedProducts = (allProducts || []).map(p => ({
    ...p,
    images: p.product_images?.map(img => img.image_url) || []
  }))

  return (
    <ProductsView 
      initialProducts={mappedProducts} 
      cats={cats || []}
      initialCategory={categorySlug}
      initialSearch={search}
      initialSort={sort}
      initialMinPrice={minPrice}
      initialMaxPrice={maxPrice}
    />
  )
}
