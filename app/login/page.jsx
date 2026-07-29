import { Suspense } from 'react'
import { AuthView } from '@/components/views/AuthView'

export const metadata = {
  title: 'Sign In | AK Enterprises',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-4"><p className="text-xs text-muted-foreground">Loading login portal...</p></div>}>
      <AuthView mode="login" />
    </Suspense>
  )
}
