import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

/**
 * Custom Hook for Customer Page: Real-time listening for catalog access approval/rejection.
 * Automatically triggers callback when Admin approves or rejects the customer's request.
 */
export function useCustomerCatalogAccess(user, onStatusChange) {
  useEffect(() => {
    if (!user || !user.id) return

    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel(`catalog_access_customer_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catalog_access_requests',
          filter: `customer_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Realtime Customer Catalog Access Change]:', payload)
          if (payload.new && typeof onStatusChange === 'function') {
            onStatusChange(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, onStatusChange])
}

/**
 * Custom Hook for Admin Panel: Real-time listening for incoming catalog access requests.
 * Triggers callback whenever a new request is inserted or updated.
 */
export function useAdminCatalogRequests(onNewRequest, onRequestUpdated) {
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel('catalog_access_admin_stream')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'catalog_access_requests'
        },
        (payload) => {
          console.log('[Realtime Admin Catalog Access INSERT]:', payload)
          if (payload.new && typeof onNewRequest === 'function') {
            onNewRequest(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'catalog_access_requests'
        },
        (payload) => {
          console.log('[Realtime Admin Catalog Access UPDATE]:', payload)
          if (payload.new && typeof onRequestUpdated === 'function') {
            onRequestUpdated(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onNewRequest, onRequestUpdated])
}
