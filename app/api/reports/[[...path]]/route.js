// ================================================================
// Reports API — /api/reports/*
// ----------------------------------------------------------------
// Dedicated route module (more specific than the legacy catch-all, so
// it wins for /api/reports/...). Every endpoint:
//   - authenticates the user (Bearer token, role from DB)
//   - requires role admin (Owner) or vendor (Zonal Admin)
//   - enforces zone scope server-side (vendor → their own zone only)
//   - validates filters via lib/reports/filters.js
//   - uses the SAME query service for preview and export
// ================================================================
import { getUser, json, err } from '@/lib/api-auth'
import { getReport as getReportData } from '@/lib/reports/query-service'
import { buildWorkbook, reportFileName } from '@/lib/reports/excel'
import { resolveReportScope, listZones } from '@/lib/reports/permissions'
import { QUICK_PRESETS, ORDER_STATUSES, GROUP_BY_OPTIONS, PAYMENT_METHODS } from '@/lib/reports/filters'
import { logReport, listReports, getReport, updateReport, isExpired } from '@/lib/reports/history'

export const maxDuration = 60

async function requireReportUser(req) {
  const user = await getUser(req)
  if (!user) return { error: err('Unauthorized', 401) }
  if (user.role !== 'admin' && user.role !== 'vendor') {
    return { error: err('Forbidden: report access is restricted to Owner and Zonal Admin roles', 403) }
  }
  return { user }
}

export async function GET(request, { params }) {
  const url = new URL(request.url)
  const segments = (await params).path || []
  const q = url.searchParams
  const { user, error: authErr } = await requireReportUser(request)
  if (authErr) return authErr

  // ── Reference: statuses / presets / zones ─────────────────────
  if (segments[0] === 'status') {
    const scope = await resolveReportScope(user)
    const zones = scope.isOwner ? await listZones() : scope.zoneId ? [{ zone_id: scope.zoneId, zone_name: scope.zoneName }] : []
    return json({
      order_statuses: ORDER_STATUSES,
      quick_presets: QUICK_PRESETS,
      group_by_options: GROUP_BY_OPTIONS,
      payment_methods: PAYMENT_METHODS,
      zones,
      is_owner: scope.isOwner,
      current_zone: scope.zoneId ? { zone_id: scope.zoneId, zone_name: scope.zoneName } : null
    })
  }

  // ── Zones (owner selector) ─────────────────────────────────────
  if (segments[0] === 'zones') {
    const scope = await resolveReportScope(user)
    const zones = scope.isOwner ? await listZones() : scope.zoneId ? [{ zone_id: scope.zoneId, zone_name: scope.zoneName }] : []
    return json({ zones, current_zone: scope.zoneId ? { zone_id: scope.zoneId, zone_name: scope.zoneName } : null, is_owner: scope.isOwner })
  }

  // ── Report history ─────────────────────────────────────────────
  if (segments[0] === 'history' && !segments[1]) {
    const list = await listReports(user, parseInt(q.get('limit') || '50', 10))
    return json({ history: list })
  }
  if (segments[0] === 'history' && segments[1]) {
    const record = await getReport(user, segments[1])
    if (!record) return err('Report history entry not found or not accessible', 404)
    return json({ report: record })
  }

  // ── Regenerate + download a past report (ownership + expiry) ──
  if (segments[0] === 'download' && segments[1]) {
    const record = await getReport(user, segments[1])
    if (!record) return err('Report not found or not accessible', 404)
    if (isExpired(record)) {
      await updateReport(record.id, { status: 'expired' })
      return err('This report has expired. Generate a new report.', 410)
    }
    // Re-run with the stored filters (deterministic regeneration).
    const res = await getReportData(user, { ...(record.filters || {}), range: record.filters?.range || record.date_range?.range || 'custom', start_date: record.date_range?.start || '', end_date: record.date_range?.end || '' })
    if (!res.ok) return err('Failed to regenerate report: ' + res.error, 500)
    const buf = await buildWorkbook(res.data)
    await updateReport(record.id, { download_count: (record.download_count || 0) + 1, status: 'completed' })
    return xlsxResponse(buf, record.file_name || reportFileName(res.data.meta.zoneName))
  }

  // ── Order export (Excel) ───────────────────────────────────────
  if (segments[0] === 'orders' && segments[1] === 'export') {
    const res = await getReportData(user, Object.fromEntries(q.entries()))
    if (!res.ok) return err('Report generation failed: ' + res.error, 500)
    const buf = await buildWorkbook(res.data)
    // Log to history (best-effort; ignored if table missing)
    const historyId = await logReport({
      user,
      reportType: 'orders',
      zoneId: res.data.meta.zoneId,
      zoneName: res.data.meta.zoneName,
      filters: res.data.meta.filters,
      file_name: reportFileName(res.data.meta.zoneName),
      status: 'completed'
    })
    void historyId
    return xlsxResponse(buf, reportFileName(res.data.meta.zoneName))
  }

  // ── Order preview (JSON — full object used by the UI) ──────────
  if (segments[0] === 'orders' && segments[1] === 'preview') {
    const res = await getReportData(user, Object.fromEntries(q.entries()))
    if (!res.ok) return err('Report generation failed: ' + res.error, 500)
    return json(res.data)
  }

  // ── Sales slice endpoints ──────────────────────────────────────
  const SALES_SLICE = {
    summary: (r) => ({ summary: r.summary, meta: r.meta, reconciliation: r.reconciliation, dataQuality: r.dataQuality }),
    'by-date': (r) => ({ meta: r.meta, by_date: r.byDate }),
    'by-product': (r) => ({ meta: r.meta, by_product: r.byProduct, top_products: r.topProducts, low_products: r.lowProducts }),
    'by-category': (r) => ({ meta: r.meta, by_category: r.byCategory }),
    'by-customer': (r) => ({ meta: r.meta, by_customer: r.byCustomer }),
    'by-location': (r) => ({ meta: r.meta, by_location: r.byLocation }),
    payments: (r) => ({ meta: r.meta, payment_report: r.paymentReport }),
    status: (r) => ({ meta: r.meta, order_status_report: r.orderStatusReport }),
    gst: (r) => ({ meta: r.meta, gst_report: r.gstReport })
  }
  if (segments[0] === 'sales' && segments[1] && SALES_SLICE[segments[1]]) {
    const res = await getReportData(user, Object.fromEntries(q.entries()))
    if (!res.ok) return err('Report generation failed: ' + res.error, 500)
    return json(SALES_SLICE[segments[1]](res.data))
  }

  return err('Unknown report endpoint: /api/reports/' + segments.join('/'), 404)
}

function xlsxResponse(buf, fileName) {
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buf.byteLength || buf.length),
      'Cache-Control': 'no-store'
    }
  })
}

// POST is not used; keep Next.js happy about the handler export.
export async function POST() {
  return err('Method not allowed', 405)
}
