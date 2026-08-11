// ================================================================
// ReportExportHistoryService
// ----------------------------------------------------------------
// Logs every report export to the report_history table so owners and
// zonal admins can audit "who generated what, when, with which
// filters". Downloads are re-generated on demand from the stored
// filters (deterministic), so the file never needs to be persisted in
// blob storage and expiry is enforced at request time.
//
// If the report_history table has not been migrated yet, this module
// degrades gracefully (warns once, no crash) — the app keeps working
// with direct synchronous downloads.
// ================================================================
import { db } from '../api-auth.js'

let tableMissing = null // null=unknown, true=missing, false=exists

async function tableExists(supabase) {
  if (tableMissing !== null) return !tableMissing
  const { error } = await supabase.from('report_history').select('id').limit(1)
  tableMissing = !!error
  if (tableMissing) {
    console.warn('[ReportHistory] report_history table not found — run schema-report-history.sql. History logging disabled.')
  }
  return !tableMissing
}

const EXPIRY_DAYS = 7

/**
 * Insert a history record. Returns the record id or null if the table
 * is unavailable.
 */
export async function logReport({ user, reportType, zoneId, zoneName, filters, file_name, status = 'completed' }) {
  const supabase = db()
  if (!(await tableExists(supabase))) return null
  const now = new Date().toISOString()
  const record = {
    report_type: reportType,
    user_id: user?.id || null,
    user_email: user?.email || '',
    zone_id: zoneId || null,
    zone_name: zoneName || '',
    filters: filters || {},
    date_range: {
      start: filters?.startDate || null,
      end: filters?.endDate || null,
      range: filters?.range || null
    },
    file_name: file_name || '',
    file_size: 0,
    status,
    error_message: null,
    download_count: 0,
    created_at: now,
    completed_at: now,
    expires_at: new Date(Date.now() + EXPIRY_DAYS * 86400000).toISOString()
  }
  const { data, error } = await supabase.from('report_history').insert(record).select('id').single()
  if (error) {
    console.error('[ReportHistory] insert failed:', error.message)
    return null
  }
  return data?.id || null
}

/** Mark a history record with status / size. */
export async function updateReport(id, patch) {
  const supabase = db()
  if (!(await tableExists(supabase))) return null
  const { error } = await supabase.from('report_history').update(patch).eq('id', id)
  if (error) console.error('[ReportHistory] update failed:', error.message)
  return !error
}

/** List history visible to a user (owner = all, vendor = own rows only). */
export async function listReports(user, limit = 50) {
  const supabase = db()
  if (!(await tableExists(supabase))) return []
  let q = supabase.from('report_history').select('*').order('created_at', { ascending: false }).limit(limit)
  if (user?.role !== 'admin') q = q.eq('user_id', user?.id)
  const { data, error } = await q
  if (error) {
    console.error('[ReportHistory] list failed:', error.message)
    return []
  }
  return (data || []).map((r) => ({ ...r, expired: new Date(r.expires_at).getTime() < Date.now() }))
}

/** Fetch a single history record (ownership enforced by caller). */
export async function getReport(user, id) {
  const supabase = db()
  if (!(await tableExists(supabase))) return null
  const { data, error } = await supabase.from('report_history').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  // Ownership: only the creator or an admin may access a record.
  if (user?.role !== 'admin' && data.user_id !== user?.id) return null
  return data
}

/** Is the record expired? */
export function isExpired(record) {
  if (!record?.expires_at) return false
  return new Date(record.expires_at).getTime() < Date.now()
}
