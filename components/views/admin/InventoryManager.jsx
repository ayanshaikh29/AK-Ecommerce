'use client'
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Package, ArrowDownRight, ArrowUpRight, Plus, RefreshCw, Search, History, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

import { useRealtimeInventory } from '@/lib/hooks/useRealtime'

export function InventoryManager() {
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Intake Form State
  const [intakeProdId, setIntakeProdId] = useState('')
  const [intakeQty, setIntakeQty] = useState('')
  const [intakeRef, setIntakeRef] = useState('')
  const [intakeNotes, setIntakeNotes] = useState('')
  const [intakeLoading, setIntakeLoading] = useState(false)

  // Outward Form State
  const [outwardProdId, setOutwardProdId] = useState('')
  const [outwardQty, setOutwardQty] = useState('')
  const [outwardRef, setOutwardRef] = useState('')
  const [outwardNotes, setOutwardNotes] = useState('')
  const [outwardLoading, setOutwardLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [prodsRes, movsRes] = await Promise.all([
        fetch('/api/products', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/admin/inventory/movements', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ])

      if (prodsRes.ok) {
        const pData = await prodsRes.json()
        setProducts(pData.products || pData || [])
        if (pData.products?.length > 0 && !intakeProdId) {
          setIntakeProdId(pData.products[0].id)
          setOutwardProdId(pData.products[0].id)
        }
      }

      if (movsRes.ok) {
        const mData = await movsRes.json()
        setMovements(mData || [])
      }
    } catch {
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  useRealtimeInventory(fetchData)

  useEffect(() => {
    fetchData()
  }, [])

  const handleIntakeSubmit = async (e) => {
    e.preventDefault()
    if (!intakeProdId || !intakeQty || Number(intakeQty) <= 0) {
      toast.error('Select a product and valid quantity')
      return
    }
    setIntakeLoading(true)
    try {
      const res = await fetch('/api/admin/inventory/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: intakeProdId,
          quantity: Number(intakeQty),
          reference: intakeRef,
          notes: intakeNotes
        })
      })
      if (res.ok) {
        toast.success('Stock intake recorded successfully!')
        setIntakeQty('')
        setIntakeRef('')
        setIntakeNotes('')
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to record intake')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setIntakeLoading(false)
    }
  }

  const handleOutwardSubmit = async (e) => {
    e.preventDefault()
    if (!outwardProdId || !outwardQty || Number(outwardQty) <= 0) {
      toast.error('Select a product and valid quantity')
      return
    }
    setOutwardLoading(true)
    try {
      const res = await fetch('/api/admin/inventory/outward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: outwardProdId,
          quantity: Number(outwardQty),
          reference: outwardRef,
          notes: outwardNotes
        })
      })
      if (res.ok) {
        toast.success('Stock outward recorded successfully!')
        setOutwardQty('')
        setOutwardRef('')
        setOutwardNotes('')
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to record outward movement')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setOutwardLoading(false)
    }
  }

  const filteredMovements = movements.filter(m => {
    const matchesType = typeFilter === 'all' || m.movement_type === typeFilter
    const matchesSearch = (m.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (m.reference || '').toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-accent" /> Inventory & Stock Movements Ledger
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Log stock received (Intake) and outward dispatches, and track real-time stock balances across all SKUs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Inventory
        </Button>
      </div>

      {/* Forms Grid: Intake & Outward */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* INTAKE FORM */}
        <Card className="radius-lg shadow-soft border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6">
            <h4 className="font-display font-bold text-base text-emerald-700 dark:text-emerald-300 mb-4 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-emerald-600" /> Log Stock Intake (+ Increase Stock)
            </h4>
            <form onSubmit={handleIntakeSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Select Product</label>
                <Select value={intakeProdId} onValueChange={setIntakeProdId}>
                  <SelectTrigger className="rounded-xl h-10 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock_quantity || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Quantity Received</label>
                  <Input
                    type="number"
                    value={intakeQty}
                    onChange={e => setIntakeQty(e.target.value)}
                    placeholder="e.g. 5000"
                    className="h-10 rounded-xl bg-background text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Supplier Ref / Invoice #</label>
                  <Input
                    value={intakeRef}
                    onChange={e => setIntakeRef(e.target.value)}
                    placeholder="PO-2026-001"
                    className="h-10 rounded-xl bg-background text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Notes / Batch Info</label>
                <Input
                  value={intakeNotes}
                  onChange={e => setIntakeNotes(e.target.value)}
                  placeholder="Received from Pune Warehouse Hub..."
                  className="h-10 rounded-xl bg-background text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={intakeLoading}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-soft"
              >
                {intakeLoading ? 'Recording...' : '+ Add Stock Intake'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* OUTWARD FORM */}
        <Card className="radius-lg shadow-soft border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <h4 className="font-display font-bold text-base text-amber-700 dark:text-amber-300 mb-4 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-600" /> Log Manual Outward (- Decrease Stock)
            </h4>
            <form onSubmit={handleOutwardSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Select Product</label>
                <Select value={outwardProdId} onValueChange={setOutwardProdId}>
                  <SelectTrigger className="rounded-xl h-10 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock_quantity || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Quantity Dispatched</label>
                  <Input
                    type="number"
                    value={outwardQty}
                    onChange={e => setOutwardQty(e.target.value)}
                    placeholder="e.g. 1000"
                    className="h-10 rounded-xl bg-background text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Dispatch Ref / Note #</label>
                  <Input
                    value={outwardRef}
                    onChange={e => setOutwardRef(e.target.value)}
                    placeholder="MANUAL-DISPATCH-88"
                    className="h-10 rounded-xl bg-background text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Notes / Reason</label>
                <Input
                  value={outwardNotes}
                  onChange={e => setOutwardNotes(e.target.value)}
                  placeholder="Damaged stock / Sample dispatch..."
                  className="h-10 rounded-xl bg-background text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={outwardLoading}
                className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-soft"
              >
                {outwardLoading ? 'Recording...' : '- Log Outward Dispatch'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Stock Movements History Table */}
      <Card className="radius-lg shadow-soft overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h4 className="font-display font-extrabold text-lg text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-accent" /> Stock Movement History Ledger
            </h4>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search product or ref..."
                  className="pl-9 h-9 rounded-xl text-xs"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="rounded-xl h-9 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Movements</SelectItem>
                  <SelectItem value="intake">Intake Only</SelectItem>
                  <SelectItem value="outward">Outward Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">Loading stock movement ledger...</div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No stock movements logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-secondary/30 transition">
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">{m.product_name}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full ${
                            m.movement_type === 'intake'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {m.movement_type === 'intake' ? '↓ INTAKE' : '↑ OUTWARD'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-sm">
                        <span className={m.movement_type === 'intake' ? 'text-emerald-600' : 'text-amber-600'}>
                          {m.movement_type === 'intake' ? '+' : '-'}{m.quantity.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{m.reference || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{m.notes || '—'}</td>
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
