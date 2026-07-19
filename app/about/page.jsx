import { AboutView } from '@/components/views/AboutView'
import { getSettings } from '@/lib/supabase'

export const metadata = {
  title: 'About Us | AK Enterprises',
}

export default async function AboutPage() {
  const settings = await getSettings()
  return <AboutView settings={settings} />
}
