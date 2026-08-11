// ================================================================
// ReportPermissionService
// ----------------------------------------------------------------
// Resolves what a user may see. The system has two report roles:
//   - admin  → Owner. May view all zones, may filter by any zone.
//   - vendor → Zonal Admin. Forced to their own zone (assigned vendor
//              record). Zone can NEVER be taken from the client.
//
// Enforced at the query layer (lib/reports/query-service.js) — the
// zone predicate is added to the DB query, never filtered in the
// frontend.
// ================================================================
import { db } from '../api-auth.js'

/**
 * Resolve the vendor (zonal admin) record for a user id/email.
 * Mirrors lib/b2b-store.js getVendorByUserId.
 */
export async function getVendorByUserId(userId, userEmail) {
  const supabase = db()
  if (userId) {
    const { data: vById } = await supabase.from('vendors').select('*').eq('user_id', userId).maybeSingle()
    if (vById) return vById
  }
  if (userEmail) {
    const cleanEmail = String(userEmail).trim().toLowerCase()
    const { data: vByEmail } = await supabase.from('vendors').select('*').eq('email', cleanEmail).maybeSingle()
    if (vByEmail) {
      if (userId && !vByEmail.user_id) {
        await supabase.from('vendors').update({ user_id: userId }).eq('id', vByEmail.id)
        vByEmail.user_id = userId
      }
      return vByEmail
    }
  }
  return null
}

/**
 * Compute the effective report scope for a user.
 * @returns {{ isOwner: boolean, zoneId: string|null, zoneName: string|null, vendor: object|null }}
 */
export async function resolveReportScope(user, requestedZoneId = '') {
  const scope = { isOwner: false, zoneId: null, zoneName: null, vendor: null }

  if (!user) return scope

  if (user.role === 'admin') {
    scope.isOwner = true
    // Owner may request a specific zone; otherwise all zones.
    if (requestedZoneId && requestedZoneId !== 'all') {
      const { data: vendor } = await db().from('vendors').select('id, name').eq('id', requestedZoneId).maybeSingle()
      if (vendor) {
        scope.zoneId = vendor.id
        scope.zoneName = vendor.name
      }
    }
    return scope
  }

  // Zonal admin (vendor) — always forced to their own zone.
  const vendor = await getVendorByUserId(user.id, user.email)
  if (vendor) {
    scope.zoneId = vendor.id
    scope.zoneName = vendor.name
    scope.vendor = vendor
  }
  return scope
}

/** All vendors (zones) — for the Owner zone selector. */
export async function listZones() {
  const { data } = await db().from('vendors').select('id, name').order('name', { ascending: true })
  return (data || []).map((v) => ({ zone_id: v.id, zone_name: v.name }))
}
