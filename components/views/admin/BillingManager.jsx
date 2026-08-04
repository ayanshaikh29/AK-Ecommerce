'use client'
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileText, Download, CheckCircle2, Clock, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch {
    return '—'
  }
}

const getDateRangeForPeriod = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { from: weekAgo, to: today }
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: monthStart, to: today }
    }
    case 'last3months': {
      const threeMonthsAgo = new Date(today)
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      return { from: threeMonthsAgo, to: today }
    }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

export function BillingManager() {
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState({ total_billed: 0, total_received: 0, total_pending: 0 })
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [customerFilter, setCustomerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [timePeriod, setTimePeriod] = useState('all')

  const fetchBilling = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (customerFilter && customerFilter !== 'all') params.set('customer_id', customerFilter)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)

      const range = getDateRangeForPeriod(timePeriod)
      if (range.from) params.set('start_date', range.from.toISOString().split('T')[0])
      if (range.to) params.set('end_date', range.to.toISOString().split('T')[0])

      const res = await fetch(`/api/admin/billing?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setSummary(data.summary || { total_billed: 0, total_received: 0, total_pending: 0 })
        if (data.all_customers) setCustomers(data.all_customers)
      } else {
        toast.error('Failed to load billing records')
      }
    } catch (err) {
      console.error('Billing fetch error:', err)
      toast.error('Error loading billing overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBilling()
  }, [customerFilter, statusFilter, timePeriod])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBilling()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handlePaymentToggle = async (orderId, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid'
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ payment_status: newStatus === 'paid' ? 'Paid' : 'Pending' })
      })
      if (res.ok) {
        toast.success(`Payment status marked as ${newStatus.toUpperCase()}`)
        fetchBilling()
      } else {
        toast.error('Failed to update payment status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const exportCSV = () => {
    if (invoices.length === 0) return
    const headers = ['Invoice #', 'Date', 'Customer Name', 'Customer Email', 'GSTIN', 'Total Amount', 'Payment Status']
    const rows = invoices.map(i => [
      i.invoice_number,
      formatDate(i.created_at),
      `"${i.customer_name || ''}"`,
      `"${i.customer_email || ''}"`,
      `"${i.gstin || '—'}"`,
      i.total_amount,
      i.payment_status
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `b2b_billing_ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Billing ledger exported to CSV')
  }

  const handleDownloadInvoice = async (orderId, invoiceNumber) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice-pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) throw new Error('Failed to download invoice')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${invoiceNumber}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice downloaded successfully')
    } catch (err) {
      console.error('Invoice download error:', err)
      toast.error(err.message || 'Failed to download invoice')
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" /> Customer Billing & Invoices Ledger
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Track customer invoicing, payment statuses, running balances, and download tax invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchBilling} className="rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Button size="sm" onClick={exportCSV} className="rounded-xl gold-gradient text-primary font-bold shadow-soft">
            <Download className="w-4 h-4 mr-1.5" /> Export Billing CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid sm:grid-cols-3 gap-6">
        <Card className="radius-lg shadow-soft border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Billed</p>
            <p className="font-display text-3xl font-extrabold text-foreground">{formatINR(summary.total_billed)}</p>
            <p className="text-[11px] text-muted-foreground mt-2">Cumulative value of all confirmed orders</p>
          </CardContent>
        </Card>

        <Card className="radius-lg shadow-soft border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Payment Received</p>
            <p className="font-display text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{formatINR(summary.total_received)}</p>
            <p className="text-[11px] text-emerald-600/80 mt-2">Payments collected and verified</p>
          </CardContent>
        </Card>

        <Card className="radius-lg shadow-soft border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Outstanding Balance</p>
            <p className="font-display text-3xl font-extrabold text-amber-700 dark:text-amber-300">{formatINR(summary.total_pending)}</p>
            <p className="text-[11px] text-amber-600/80 mt-2">Pending payment collections</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice # or customer..."
              className="pl-9 h-10 rounded-xl bg-card text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Period Filter */}
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="rounded-xl h-10 w-40 bg-card text-xs">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>

          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="rounded-xl h-10 w-52 bg-card text-xs">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(cust => (
                <SelectItem key={cust.id} value={cust.id}>
                  {cust.full_name || cust.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl h-10 w-36 bg-card text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoices Table */}
      <Card className="radius-lg shadow-soft overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">Loading billing records...</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">No invoices found matching criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Name & Email</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-secondary/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{inv.customer_name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{inv.customer_email || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{inv.gstin || '—'}</td>
                      <td className="py-3 px-4 font-mono font-extrabold text-sm">{formatINR(inv.total_amount)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handlePaymentToggle(inv.order_id, inv.payment_status)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition ${
                            inv.payment_status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-amber-500/15 text-amber-600'
                          }`}
                        >
                          {inv.payment_status === 'paid' ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Payment Received</>
                          ) : (
                            <><Clock className="w-3.5 h-3.5" /> Payment Pending</>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDownloadInvoice(inv.order_id, inv.invoice_number)}
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}