'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CustomerDashboardView } from '@/components/views/CustomerDashboardView'
import { useAppContext } from '@/components/providers/AppProvider'

export default function CustomerDashboardPage() {
  const { user } = useAppContext()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!user) {
    router.replace('/login')
    return null
  }

  if (user.role !== 'customer') {
    router.replace('/')
    return null
  }

  return <CustomerDashboardView user={user} />
}
