import './globals.css'
import { Toaster } from 'sonner'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import { AppProvider } from '@/components/providers/AppProvider'
import { Footer } from '@/components/layout/Footer'
import { TopMarquee } from '@/components/layout/TopMarquee'
import { getSettings } from '@/lib/supabase'

const Navbar = dynamic(() => import('@/components/layout/Navbar').then(m => ({ default: m.Navbar })), { loading: () => <div className="h-16" /> })
const CartDrawer = dynamic(() => import('@/components/layout/CartDrawer').then(m => ({ default: m.CartDrawer })))
const WhatsAppButton = dynamic(() => import('@/components/layout/WhatsAppButton').then(m => ({ default: m.WhatsAppButton })))
const SupportChatbot = dynamic(() => import('@/components/layout/SupportChatbot').then(m => ({ default: m.SupportChatbot })))
const CompareFloatingBar = dynamic(() => import('@/components/product/CompareFloatingBar').then(m => ({ default: m.CompareFloatingBar })))
const MobileBottomNav = dynamic(() => import('@/components/layout/MobileBottomNav').then(m => ({ default: m.MobileBottomNav })))

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: 'AK Enterprises — Office Stationery, Housekeeping & UPS Solutions',
  description: 'Your trusted B2B partner for office stationery, housekeeping materials and UPS supply. Pan India delivery. Established 2020, Pune.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  manifest: '/site.webmanifest'
}

export default async function RootLayout({ children }) {
  const settings = await getSettings()

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preload" as="style" href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400&f[]=general-sans@600,500,400&display=swap" />
        <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400&f[]=general-sans@600,500,400&display=swap" rel="stylesheet" media="print" onLoad="this.media='all'" />
        <noscript><link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400&f[]=general-sans@600,500,400&display=swap" /></noscript>
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}',{page_path:window.location.pathname});`
              }}
            />
          </>
        )}
      </head>
      <body className={`antialiased ${inter.variable}`} suppressHydrationWarning>
        <AppProvider>
          <div className="min-h-screen flex flex-col">
            <TopMarquee settings={settings} />
            <Navbar settings={settings} />
            <main className="flex-1 page-transition pb-32 md:pb-0">
              {children}
            </main>
            <Footer settings={settings} />
            <CartDrawer />
            <WhatsAppButton settings={settings} />
            <SupportChatbot settings={settings} />
            <CompareFloatingBar />
            <MobileBottomNav />
          </div>
        </AppProvider>
        <Toaster position="top-center" richColors closeButton toastOptions={{style:{fontFamily:'Inter, system-ui, sans-serif'}}} />
      </body>
    </html>
  )
}
