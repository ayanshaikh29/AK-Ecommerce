import { createClient } from '@supabase/supabase-js'

let _realtimeClient = null
let _initPromise = null

export async function getRealtimeClient() {
  if (_realtimeClient) return _realtimeClient
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      
      const res = await fetch('/api/realtime-config', { headers })
      if (!res.ok) throw new Error(`Realtime config failed: ${res.status}`)
      
      const { supabaseUrl, supabaseKey } = await res.json()
      if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials for Realtime')

      _realtimeClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      })
      return _realtimeClient
    } catch (e) {
      console.warn('[RealtimeClient] Initialization failed:', e.message)
      _initPromise = null
      return null
    }
  })()

  return _initPromise
}

export function resetRealtimeClient() {
  _realtimeClient = null
  _initPromise = null
}
