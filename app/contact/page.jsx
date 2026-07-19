import { ContactView } from '@/components/views/ContactView'
import { getSettings } from '@/lib/supabase'

export const metadata = {
  title: 'Contact Us | AK Enterprises',
}

export default async function ContactPage() {
  const settings = await getSettings()
  return <ContactView settings={settings} />
}
