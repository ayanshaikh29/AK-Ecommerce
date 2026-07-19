import { getSupabase } from '@/lib/supabase'
import { ProductDetailView } from '@/components/views/ProductDetailView'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  const supabase = getSupabase()
  const { slug } = await params
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  const query = isUUID
    ? supabase.from('products').select('*, product_images(image_url)').eq('id', slug)
    : supabase.from('products').select('*, product_images(image_url)').eq('slug', slug)
  const { data: product } = await query.maybeSingle()

  if (!product) return { title: 'Product Not Found' }

  const image = product.product_images?.[0]?.image_url
  const title = `${product.name} — ₹${product.price} | AK Enterprises`
  const description = product.description?.slice(0, 160) || `Buy ${product.name} at best B2B wholesale price from AK Enterprises. GST invoice available.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image, width: 800, height: 800, alt: product.name }] : [],
      type: 'website',
      siteName: 'AK Enterprises',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    }
  }
}


export default async function ProductPage({ params }) {
  const supabase = getSupabase()
  const { slug } = await params
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  const query = isUUID
    ? supabase.from('products').select('*, product_images(image_url)').eq('id', slug)
    : supabase.from('products').select('*, product_images(image_url)').eq('slug', slug)
  const { data: product } = await query.maybeSingle()
  
  if (!product) {
    notFound()
  }

  const [
    { data: cat },
    { data: related },
    { data: reviews }
  ] = await Promise.all([
    supabase.from('categories').select('*').eq('id', product.category_id).maybeSingle(),
    supabase.from('products').select('*, product_images(image_url)').eq('category_id', product.category_id).neq('id', product.id).limit(4),
    supabase.from('reviews').select('*').eq('product_id', product.id).order('created_at', { ascending: false })
  ])

  const productData = {
    ...product,
    images: product.product_images?.map(img => img.image_url) || [],
    category: cat,
    related: (related || []).map(p => ({
      ...p,
      images: p.product_images?.map(img => img.image_url) || []
    })),
    reviews: reviews || []
  }

  return <ProductDetailView initialProduct={productData} />
}
