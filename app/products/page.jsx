import { getSupabase } from '@/lib/supabase'
import { ProductsView } from '@/components/views/ProductsView'

export default async function ProductsPage({ searchParams }) {
  const supabase = getSupabase()
  
  // Await searchParams in Next.js 15
  const sp = (await searchParams) || {}
  const categorySlug = sp.category || ''
  const search = sp.search || ''
  const featured = sp.featured === '1'
  const sort = sp.sort || 'newest'
  const minPrice = sp.minPrice ? parseInt(sp.minPrice) : 0
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice) : 15000
  const brand = sp.brand || ''
  const rating = sp.rating ? parseFloat(sp.rating) : 0

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
      if (brand) query = query.eq('brand', brand)
      if (rating) query = query.gte('rating_avg', rating)
      
      if (sort === 'price-asc') query = query.order('price', { ascending: true })
      else if (sort === 'price-desc') query = query.order('price', { ascending: false })
      else if (sort === 'popular') query = query.order('rating_count', { ascending: false })
      else query = query.order('created_at', { ascending: false })
      
      return query
    })()
  ])

  const mappedProducts = (allProducts || []).map(p => {
    const rawImgs = (p.product_images || []).map(img => img.image_url).filter(Boolean)
    let finalImgs = []
    if (rawImgs.length > 0) finalImgs = rawImgs
    else if (p.images && p.images.length > 0) finalImgs = p.images.filter(Boolean)
    else if (p.image_url) finalImgs = [p.image_url]
    else finalImgs = ['/placeholder.png']

    return {
      ...p,
      images: finalImgs,
      image_url: finalImgs[0]
    }
  })

  return (
    <ProductsView 
      initialProducts={mappedProducts} 
      cats={cats || []}
      initialCategory={categorySlug}
      initialSearch={search}
      initialSort={sort}
      initialMinPrice={minPrice}
      initialMaxPrice={maxPrice}
      initialBrand={brand}
      initialRating={rating}
    />
  )
}
