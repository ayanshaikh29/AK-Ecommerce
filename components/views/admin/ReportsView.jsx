'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  TrendingUp, Download, RefreshCw, FilterX, Search, Loader2, Calendar,
  FileSpreadsheet, History, LayoutDashboard, Package, Users, MapPin,
  CreditCard, ListChecks, Receipt, Building2, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const fmtINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN')
const fmtDate = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '—' }
}

const TABS = [
  ['overview', 'Dashboard', LayoutDashboard],
  ['orders', 'Orders', FileSpreadsheet],
  ['products', 'Products', Package],
  ['categories', 'Categories', Building2],
  ['customers', 'Customers', Users],
  ['locations', 'Locations', MapPin],
  ['payments', 'Payments', CreditCard],
  ['status', 'Status', ListChecks],
  ['gst', 'GST', Receipt],
  ['history', 'History', History]
]

const PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['this-week', 'This Week'], ['last-7-days', 'Last 7 Days'],
  ['this-month', 'This Month'], ['last-30-days', 'Last 30 Days'], ['last-90-days', 'Last 90 Days'],
  ['this-year', 'This Year'], ['prev-year', 'Last Year'], ['all', 'All Time']
]

export function ReportsView() {
  const [filters, setFilters] = useState({ range: 'last-30-days', start_date: '', end_date: '', status: 'all', payment_status: 'all', payment_method: 'all', group_by: 'day', zone_id: 'all' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [refMeta, setRefMeta] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [historyList, setHistoryList] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [search, setSearch] = useState('')

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  // Load reference metadata (statuses, presets, zones) once.
  useEffect(() => {
    fetch('/api/reports/status', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setRefMeta(d))
      .catch(() => {})
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queryString = useCallback(() => {
    const p = new URLSearchParams()
    // range is always meaningful (including the 'all' preset)
    p.set('range', filters.range)
    if (filters.start_date) p.set('start_date', filters.start_date)
    if (filters.end_date) p.set('end_date', filters.end_date)
    if (filters.status !== 'all') p.set('status', filters.status)
    if (filters.payment_status !== 'all') p.set('payment_status', filters.payment_status)
    if (filters.payment_method !== 'all') p.set('payment_method', filters.payment_method)
    if (filters.group_by) p.set('group_by', filters.group_by)
    if (filters.zone_id && filters.zone_id !== 'all') p.set('zone_id', filters.zone_id)
    if (search) p.set('search', search)
    return p.toString()
  }, [filters, search])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/orders/preview?${queryString()}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load report')
      setReport(d)
    } catch (e) {
      console.error('Report preview error:', e)
      setError(e.message)
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/reports/history?limit=30', { headers: authHeaders() })
      const d = await res.json()
      if (res.ok) setHistoryList(d.history || [])
    } catch (e) { /* ignore */ }
    finally { setHistoryLoading(false) }
  }

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const downloadExcel = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/orders/export?${queryString()}`, { headers: authHeaders() })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Export failed')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="?([^";]+)"?/)
      const fileName = match ? match[1] : `AK_Enterprises_Order_Report_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Excel report downloaded')
      loadHistory()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(false)
    }
  }

  const setRange = (r) => {
    setFilters((f) => ({ ...f, range: r, start_date: '', end_date: '' }))
  }

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'range' && k !== 'group_by' && v !== '' && v !== 'all').length + (search ? 1 : 0)
  const clearAll = () => {
    setFilters({ range: 'last-30-days', start_date: '', end_date: '', status: 'all', payment_status: 'all', payment_method: 'all', group_by: 'day', zone_id: 'all' })
    setSearch('')
  }

  const summary = report?.summary
  const isOwner = refMeta?.is_owner
  const currentZone = refMeta?.current_zone

  return (
    <div className="space-y-6 slide-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" /> Sales & Orders Report
          </h1>
          <p className="text-sm text-muted-foreground">Owner / Zonal Admin analytics — preview and export accurate Excel reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner === false && currentZone && (
            <Badge className="rounded-full px-3 py-1"><TruckIcon /> Zone: {currentZone.zone_name}</Badge>
          )}
          <Button onClick={fetchReport} variant="outline" className="rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </Button>
          <Button onClick={downloadExcel} className="rounded-xl gold-gradient text-primary font-extrabold" disabled={exporting || loading}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="radius-lg shadow-soft">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filters.range === k ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/70 text-muted-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value, range: 'custom' }))} className="h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value, range: 'custom' }))} className="h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Order Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(refMeta?.order_statuses || []).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select value={filters.payment_status} onValueChange={(v) => setFilters((f) => ({ ...f, payment_status: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially paid">Partially Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Group By</Label>
              <Select value={filters.group_by} onValueChange={(v) => setFilters((f) => ({ ...f, group_by: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['day', 'week', 'month', 'quarter', 'year'].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isOwner && (
              <div>
                <Label className="text-xs">Zone</Label>
                <Select value={filters.zone_id} onValueChange={(v) => setFilters((f) => ({ ...f, zone_id: v }))}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {(refMeta?.zones || []).map((z) => <SelectItem key={z.zone_id} value={z.zone_id}>{z.zone_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search order no, customer, product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
            </div>
            <Button onClick={clearAll} variant="outline" className="rounded-xl h-10"><FilterX className="w-4 h-4" /> Clear all {activeFilterCount > 0 && `(${activeFilterCount})`}</Button>
            {summary && <span className="text-xs text-muted-foreground font-medium ml-auto">Matching orders: <b className="text-foreground">{fmtNum(summary.totalOrders)}</b></span>}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === k ? 'bg-primary text-primary-foreground shadow-soft' : 'bg-card border text-muted-foreground hover:bg-secondary'}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 flex items-center gap-3 text-destructive">
            <AlertTriangle className="w-5 h-5" /> {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 skeleton radius-xl" />)}
        </div>
      ) : !report ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">No data found for the selected filters.</CardContent></Card>
      ) : activeTab === 'overview' ? (
        <OverviewTab report={report} />
      ) : activeTab === 'history' ? (
        <HistoryTab list={historyList} loading={historyLoading} />
      ) : (
        <DataTab activeTab={activeTab} report={report} />
      )}
    </div>
  )
}

function TruckIcon() { return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" /> }

// ── Dashboard tab ──────────────────────────────────────────────────────
function OverviewTab({ report }) {
  const s = report.summary
  const kpis = [
    ['Total Orders', fmtNum(s.totalOrders), 'orders'],
    ['Net Revenue', fmtINR(s.netRevenue), 'money'],
    ['Gross Sales', fmtINR(s.grossSales), 'money'],
    ['Total GST', fmtINR(s.totalGST), 'money'],
    ['Total Discounts', fmtINR(s.totalDiscounts), 'money'],
    ['Unique Customers', fmtNum(s.uniqueCustomers), 'num'],
    ['Products Sold', fmtNum(s.totalProductsSold), 'num'],
    ['Delivered Products', fmtNum(s.totalDeliveredProducts), 'num'],
    ['Pending Orders', fmtNum(s.pendingOrders), 'num'],
    ['Avg Order Value', fmtINR(s.avgOrderValue), 'money'],
    ['Cancelled', fmtNum(s.cancelledOrders), 'num'],
    ['Returned', fmtNum(s.returnedOrders), 'num']
  ]
  const maxByDate = Math.max(...(report.byDate || []).map((d) => d.netRevenue || 0), 1)
  const maxStatus = Math.max(...(report.orderStatusReport || []).map((d) => d.orders || 0), 1)
  const rec = report.reconciliation || {}

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(([label, value, kind]) => (
          <Card key={label} className={`radius-xl shadow-soft p-4 border ${kind === 'money' ? 'bg-primary text-primary-foreground' : ''}`}>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${kind === 'money' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{label}</span>
            <h2 className="text-xl md:text-2xl font-extrabold mt-1.5 break-words">{value}</h2>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-4">Sales by {report.meta?.filters?.group_by || 'day'} — Net Revenue</h3>
          {report.byDate?.length === 0 ? <p className="text-xs text-muted-foreground py-10 text-center">No sales in range</p> : (
            <div className="flex items-end gap-1 h-44">
              {(report.byDate || []).slice(-31).map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center group relative">
                  <span className="absolute -top-6 text-[8px] font-bold bg-popover px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{fmtINR(d.netRevenue)}</span>
                  <div className="w-full bg-accent/40 group-hover:bg-accent rounded-t transition-all" style={{ height: `${Math.max(3, (d.netRevenue / maxByDate) * 100)}%` }} />
                  <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">{d.period}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-4">Orders by Status</h3>
          <div className="space-y-2">
            {(report.orderStatusReport || []).slice(0, 12).map((r) => (
              <div key={r.status}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-semibold capitalize">{r.status.replace(/_/g, ' ')}</span>
                  <span>{fmtNum(r.orders)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(100, (r.orders / maxStatus) * 100)}%` }} />
                </div>
              </div>
            ))}
            {(report.orderStatusReport || []).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">No orders</p>}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-4">Top-Selling Products</h3>
          <div className="space-y-2">
            {(report.topProducts || []).map((p, i) => (
              <div key={p.product_id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-xs"><b className="text-muted-foreground mr-2">{i + 1}</b>{p.name}</span>
                <Badge className="rounded-full">{fmtNum(p.qtySold)} sold · {fmtINR(p.net)}</Badge>
              </div>
            ))}
            {(report.topProducts || []).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">No products sold</p>}
          </div>
        </Card>

        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-4">Low-Selling Products</h3>
          <div className="space-y-2">
            {(report.lowProducts || []).map((p, i) => (
              <div key={p.product_id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-xs"><b className="text-muted-foreground mr-2">{i + 1}</b>{p.name}</span>
                <Badge className="rounded-full">{fmtNum(p.qtySold)} sold</Badge>
              </div>
            ))}
            {(report.lowProducts || []).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">No products</p>}
          </div>
        </Card>
      </div>

      {/* Reconciliation + Data quality */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Reconciliation</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Report orders" value={fmtNum(rec.reportOrders ?? s.totalOrders)} />
            <Info label="Orders-page orders" value={fmtNum(rec.ordersPageOrders ?? '—')} />
            <Info label="Report net revenue" value={fmtINR(rec.reportNetRevenue ?? s.netRevenue)} />
            <Info label="Orders-page revenue" value={fmtINR(rec.ordersPageRevenue ?? 0)} />
          </div>
          {rec.revenueMatches === true ? (
            <p className="mt-3 text-xs text-emerald-600 font-bold">✓ Totals match the Orders page.</p>
          ) : (
            <p className="mt-3 text-xs text-destructive font-bold">⚠ Totals differ — investigate before export.</p>
          )}
        </Card>
        <Card className="radius-xl shadow-soft border p-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Data Quality</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Lines missing GSTIN" value={fmtNum(report.dataQuality?.missingGstin ?? 0)} />
            <Info label="Lines missing HSN" value={fmtNum(report.dataQuality?.missingHsn ?? 0)} />
            <Info label="Lines missing company" value={fmtNum(report.dataQuality?.missingCompany ?? 0)} />
            <Info label="Lines unassigned zone" value={fmtNum(report.dataQuality?.missingZone ?? 0)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Missing values are shown as blank in Excel — never invented.</p>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
    </div>
  )
}

// ── History tab ────────────────────────────────────────────────────────
function HistoryTab({ list, loading }) {
  return (
    <Card className="radius-xl shadow-soft border">
      <CardContent className="p-5">
        <h3 className="font-bold text-sm mb-4">Report History</h3>
        {loading ? <div className="h-24 skeleton rounded-xl" /> : list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No reports generated yet. Download an Excel report to populate history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary text-left"><th className="p-2 font-bold">Type</th><th className="p-2 font-bold">Zone</th><th className="p-2 font-bold">Filters</th><th className="p-2 font-bold">File</th><th className="p-2 font-bold">Status</th><th className="p-2 font-bold">Downloads</th><th className="p-2 font-bold">Generated</th><th className="p-2 font-bold">Expires</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 capitalize">{r.report_type}</td>
                    <td className="p-2">{r.zone_name || 'All zones'}</td>
                    <td className="p-2 max-w-[220px] truncate">{r.filters?.status || 'all'} · {r.filters?.range || ''}</td>
                    <td className="p-2 max-w-[200px] truncate font-mono">{r.file_name}</td>
                    <td className="p-2">
                      <Badge className={`rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : r.expired ? 'bg-gray-500/10 text-gray-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {r.expired ? 'expired' : r.status}
                      </Badge>
                    </td>
                    <td className="p-2">{r.download_count}</td>
                    <td className="p-2">{fmtDate(r.created_at)}</td>
                    <td className="p-2">{fmtDate(r.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Generic data tab ───────────────────────────────────────────────────
function DataTab({ activeTab, report }) {
  const meta = report.meta
  const configs = {
    orders: {
      title: 'Orders Summary', rows: report.orderSummaries || [],
      cols: [
        ['order_number', 'Order No'], ['status', 'Status'], ['payment_status', 'Payment'], ['customer_name', 'Customer'],
        ['company_name', 'Company'], ['zone_name', 'Zone'], ['product_names', 'Products', 'wide'], ['quantity', 'Qty', 'num'],
        ['subtotal', 'Product Amt', 'money'], ['gst', 'GST', 'money'], ['total', 'Total', 'money']
      ]
    },
    products: {
      title: 'Products Sold', rows: report.byProduct || [],
      cols: [
        ['name', 'Product'], ['category', 'Category'], ['hsn', 'HSN'], ['brand', 'Brand'], ['qtySold', 'Qty Sold', 'num'],
        ['qtyDelivered', 'Delivered', 'num'], ['gross', 'Gross', 'money'], ['gst', 'GST', 'money'], ['net', 'Net', 'money'], ['qtyRank', 'Rank', 'num']
      ]
    },
    categories: {
      title: 'Sales by Category', rows: report.byCategory || [],
      cols: [
        ['category', 'Category'], ['orders', 'Orders', 'num'], ['qty', 'Qty', 'num'], ['gross', 'Gross', 'money'],
        ['gst', 'GST', 'money'], ['net', 'Net', 'money'], ['pctOfRevenue', '% of Revenue', 'pct']
      ]
    },
    customers: {
      title: 'Sales by Customer', rows: report.byCustomer || [],
      cols: [
        ['name', 'Customer'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['state', 'State'],
        ['totalOrders', 'Orders', 'num'], ['qty', 'Qty', 'num'], ['gross', 'Gross', 'money'], ['net', 'Net', 'money'],
        ['type', 'Type'], ['firstOrder', 'First Order', 'date'], ['rank', 'Rank', 'num']
      ]
    },
    locations: {
      title: 'Sales by Location', rows: report.byLocation || [],
      cols: [
        ['state', 'State'], ['city', 'City'], ['pincode', 'Pin'], ['zone', 'Zone'], ['orders', 'Orders', 'num'],
        ['qty', 'Qty', 'num'], ['gross', 'Gross', 'money'], ['gst', 'GST', 'money'], ['net', 'Net', 'money']
      ]
    },
    payments: {
      title: 'Payment Report', rows: report.paymentReport || [],
      cols: [
        ['method', 'Method'], ['status', 'Status'], ['orders', 'Orders', 'num'], ['gross', 'Gross', 'money'],
        ['paid', 'Paid', 'money'], ['due', 'Due', 'money'], ['net', 'Net', 'money']
      ]
    },
    status: {
      title: 'Order Status Report', rows: report.orderStatusReport || [],
      cols: [
        ['status', 'Status'], ['orders', 'Orders', 'num'], ['quantity', 'Qty', 'num'], ['gross', 'Gross', 'money'],
        ['net', 'Net', 'money'], ['pctOfOrders', '% of Orders', 'pct']
      ]
    },
    gst: {
      title: 'GST Report', rows: report.gstReport || [],
      cols: [
        ['order_number', 'Order No'], ['customer_name', 'Customer'], ['gstin', 'GSTIN'], ['state', 'State'],
        ['hsn_code', 'HSN'], ['product_name', 'Product', 'wide'], ['quantity', 'Qty', 'num'], ['taxable_amount', 'Taxable', 'money'],
        ['gst_percent', 'GST %', 'num'], ['cgst', 'CGST', 'money'], ['sgst', 'SGST', 'money'], ['igst', 'IGST', 'money'],
        ['total_gst', 'Total GST', 'money'], ['invoice_amount', 'Invoice Amt', 'money']
      ]
    }
  }
  const cfg = configs[activeTab]
  if (!cfg) return null

  return (
    <Card className="radius-xl shadow-soft border overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">{cfg.title} <span className="text-muted-foreground font-normal">({fmtNum(cfg.rows.length)} rows)</span></h3>
          <span className="text-[10px] text-muted-foreground">{meta?.dateRangeLabel} · {meta?.zoneName}</span>
        </div>
        {cfg.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-12 text-center">No data found for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-secondary">
                <tr>{cfg.cols.map(([key, label]) => <th key={key} className="p-2 text-left font-bold whitespace-nowrap">{label}</th>)}</tr>
              </thead>
              <tbody>
                {cfg.rows.map((r, i) => (
                  <tr key={i} className={`border-t ${i % 2 ? 'bg-secondary/30' : ''}`}>
                    {cfg.cols.map(([key, label, kind]) => (
                      <td key={key} className={`p-2 whitespace-nowrap max-w-[260px] truncate ${kind === 'money' ? 'text-right font-semibold' : kind === 'num' ? 'text-right' : ''}`}>
                        {cellValue(r[key], kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function cellValue(v, kind) {
  if (kind === 'money') return fmtINR(v)
  if (kind === 'num') return fmtNum(v)
  if (kind === 'pct') return Number(v || 0).toFixed(2) + '%'
  if (kind === 'date') return fmtDate(v)
  if (kind === 'wide') return String(v ?? '—')
  return String(v ?? '—')
}
