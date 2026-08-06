import { AboutView } from '@/components/views/AboutView'
import { getSettings, getSiteContent } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'About Us | AK Enterprises',
}

export default async function AboutPage() {
  const [settings, siteContent] = await Promise.all([getSettings(), getSiteContent('about')])
  return <AboutView settings={settings} siteContent={siteContent} />
}
