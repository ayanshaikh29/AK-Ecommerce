import { getSettings } from '@/lib/supabase'
import Link from 'next/link'

export const metadata = {
  title: 'Terms & Conditions | AK Enterprises',
}

export default async function TermsConditionsPage() {
  const settings = await getSettings()
  const content = settings?.policy_terms || 'Terms & conditions content is currently empty. Manage this text in Site Settings.'

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 slide-up">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-extrabold mb-4 text-primary">Terms & Conditions</h1>
        <p className="text-muted-foreground text-xs">Last updated: {new Date().toLocaleDateString('en-IN')}</p>
      </div>
      <div className="bg-card border rounded-2xl p-6 md:p-10 shadow-soft max-w-none">
        <p className="whitespace-pre-wrap leading-relaxed text-foreground/80 text-sm md:text-base">{content}</p>
      </div>
      <div className="text-center mt-8">
        <Link href="/" className="text-accent font-bold hover:underline text-sm">&larr; Back to Home</Link>
      </div>
    </div>
  )
}
