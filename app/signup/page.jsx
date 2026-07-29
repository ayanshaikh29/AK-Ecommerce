'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login?notice=signup_disabled')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground font-semibold">Redirecting to Login...</p>
        <p className="text-xs text-muted-foreground/70">Self-registration is disabled. Please sign in with your credentials.</p>
      </div>
    </div>
  )
}
