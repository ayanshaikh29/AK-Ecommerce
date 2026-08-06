import { ContactView } from '@/components/views/ContactView'
import { getSettings, getSiteContent } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Contact Us | AK Enterprises',
}

export default async function ContactPage() {
  const [settings, siteContent] = await Promise.all([getSettings(), getSiteContent('contact')])
  return <ContactView settings={settings} siteContent={siteContent} />
}
