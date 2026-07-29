'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { DollarSign, Eye, EyeOff, Search, Layers, RefreshCw, CheckCircle2, ShieldCheck, TrendingUp, Save, X, AlertCircle, UserPlus, Copy, MessageCircle, Check, Lock, Key } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { useRealtimePricing, useRealtimeCustomers } from '@/lib/hooks/useRealtime'
import { useAdminCatalogRequests } from '@/lib/hooks/useCatalogAccessRealtime'

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {}
}

export function CustomerPricingManager() {
  const [activeTab, setActiveTab] = useState('pricing') // 'pricing' | 'requests' | 'logins'
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerData, setCustomerData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  // Pending unsaved edits state: { [productId]: { custom_price, is_visible } }
  const [pendingEdits, setPendingEdits] = useState({})
  const [bulkSaveLoading, setBulkSaveLoading] = useState(false)

  // Catalog requests & customer logins state
  const [catalogRequests, setCatalogRequests] = useState([])
  const [customerLogins, setCustomerLogins] = useState([])
  const [reqLoading, setReqLoading] = useState(false)

  // Bulk action state
  const [bulkCat, setBulkCat] = useState('all')
  const [bulkAction, setBulkAction] = useState('markup_percent')
  const [bulkValue, setBulkValue] = useState('10')
  const [bulkVisibility, setBulkVisibility] = useState(true)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Admin Account Creation State (Customer & Vendor)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ role: 'customer', full_name: '', email: '', phone: '', password: '' })
  const [creatingCust, setCreatingCust] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustForm.full_name || !newCustForm.email || !newCustForm.password) {
      toast.error('Full Name, Email, and Password are required')
      return
    }
    setCreatingCust(true)
    try {
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          role: newCustForm.role || 'customer',
          full_name: newCustForm.full_name,
          email: newCustForm.email,
          phone: newCustForm.phone,
          password: newCustForm.password
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || errData.message || 'Failed to create account')
      }

      const data = await res.json()
      toast.success(`${newCustForm.role === 'vendor' ? 'Vendor' : 'Customer'} account created successfully!`)
      setCreateDialogOpen(false)
      setCreatedCredentials({ ...data.user, role: newCustForm.role })
      setNewCustForm({ role: 'customer', full_name: '', email: '', phone: '', password: '' })
      fetchCustomerList()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreatingCust(false)
    }
  }

  const fetchCustomerList = useCallback(() => {
    fetch('/api/admin/customers', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setCustomers(data || [])
        if (data && data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data[0].id)
        }
      })
      .catch(err => console.error('Error fetching customers:', err))
  }, [selectedCustomerId])

  useRealtimeCustomers(fetchCustomerList)

  // Fetch customer list on mount
  useEffect(() => {
    fetchCustomerList()
  }, [fetchCustomerList])

  // Fetch requests & logins
  const fetchRequestsAndLogins = async () => {
    setReqLoading(true)
    const token = localStorage.getItem('token')
    try {
      const [reqRes, loginRes] = await Promise.all([
        fetch('/api/admin/catalog-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/customer-logins', { headers: { Authorization: `Bearer ${token}` } })
      ])
      if (reqRes.ok) {
        const rData = await reqRes.json()
        setCatalogRequests(rData || [])
      }
      if (loginRes.ok) {
        const lData = await loginRes.json()
        setCustomerLogins(lData || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setReqLoading(false)
    }
  }

  useEffect(() => {
    fetchRequestsAndLogins()
  }, [])

  // Real-time catalog access requests stream for Admin
  useAdminCatalogRequests(
    useCallback((newReq) => {
      playChime()
      setCatalogRequests(prev => {
        const exists = prev.some(r => r.id === newReq.id)
        if (exists) return prev.map(r => r.id === newReq.id ? newReq : r)
        return [newReq, ...prev]
      })
      toast.success('🟢 New Catalog Request', {
        description: `${newReq.customer_name || 'Customer'} (${newReq.email}) requested catalog access.`
      })
    }, []),
    useCallback((updatedReq) => {
      setCatalogRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r))
    }, [])
  )

  const handleApproveRequest = async (req) => {
    const token = localStorage.getItem('token')
    try {
      setCatalogRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r))
      const res = await fetch(`/api/admin/catalog-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'approved', customer_id: req.customer_id })
      })
      if (res.ok) {
        toast.success(`Catalog Access Approved for ${req.customer_name || 'Customer'}!`, {
          description: 'Customer catalog unlocked live without refresh.'
        })
        fetchCustomerList()
      } else {
        toast.error('Failed to approve access request.')
        fetchRequestsAndLogins()
      }
    } catch (e) {
      toast.error('Error approving request: ' + e.message)
      fetchRequestsAndLogins()
    }
  }

  const handleRejectRequest = async (req) => {
    const token = localStorage.getItem('token')
    try {
      setCatalogRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))
      const res = await fetch(`/api/admin/catalog-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'rejected', customer_id: req.customer_id })
      })
      if (res.ok) {
        toast.info(`Request Rejected for ${req.customer_name || 'Customer'}`)
      } else {
        toast.error('Failed to reject request.')
        fetchRequestsAndLogins()
      }
    } catch (e) {
      toast.error('Error rejecting request: ' + e.message)
      fetchRequestsAndLogins()
    }
  }

  // Fetch pricing data when customer selection changes or when Refresh is clicked
  const fetchPricing = async (cId, isManualRefresh = false) => {
    if (!cId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/customer-pricing?customer_id=${cId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        setCustomerData(data)
        setPendingEdits({}) // clear unsaved edits on fresh load
        if (isManualRefresh) {
          toast.success('Customer pricing table refreshed')
        }
      } else {
        toast.error('Failed to load customer pricing')
      }
    } catch (e) {
      toast.error('Error loading customer pricing: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedCustomerId) {
      fetchPricing(selectedCustomerId)
    }
  }, [selectedCustomerId])

  // Track pending change for a single product row
  const handleRowChange = useCallback((productId, customPrice, isVisible) => {
    const orig = customerData?.products?.find(p => p.product_id === productId)
    const origPrice = orig ? Number(orig.custom_price || orig.default_price || 0) : 0
    const origVis = orig ? Boolean(orig.is_visible) : true
    const newPrice = Number(customPrice)
    const newVis = Boolean(isVisible)

    if (orig && origPrice === newPrice && origVis === newVis) {
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    } else {
      setPendingEdits(prev => ({
        ...prev,
        [productId]: { custom_price: newPrice, is_visible: newVis }
      }))
    }
  }, [customerData])

  // Single row save
  const handleSingleSave = async (productId, customPrice, isVisible) => {
    try {
      const res = await fetch('/api/admin/customer-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          product_id: productId,
          custom_price: customPrice,
          is_visible: isVisible
        })
      })
      if (res.ok) {
        toast.success('Customer price updated')
        setPendingEdits(prev => {
          const next = { ...prev }
          delete next[productId]
          return next
        })
        fetchPricing(selectedCustomerId)
      } else {
        toast.error('Failed to update price')
      }
    } catch {
      toast.error('Failed to save price')
    }
  }

  // Bulk Save All pending changes
  const handleSaveAll = async () => {
    const pendingList = Object.entries(pendingEdits)
    if (pendingList.length === 0 || !selectedCustomerId) return

    setBulkSaveLoading(true)
    const batchUpdates = pendingList.map(([pId, data]) => ({
      customer_id: selectedCustomerId,
      product_id: pId,
      custom_price: data.custom_price,
      is_visible: data.is_visible
    }))

    try {
      const res = await fetch('/api/admin/customer-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ batch_updates: batchUpdates })
      })

      if (res.ok) {
        toast.success(`✓ Successfully saved ${pendingList.length} product changes!`)
        setPendingEdits({})
        fetchPricing(selectedCustomerId)
      } else {
        toast.error('Failed to save bulk changes. Trying row-by-row fallback...')
        // Fallback to row-by-row saving in parallel
        let successCount = 0
        let failCount = 0
        const remainingEdits = { ...pendingEdits }

        await Promise.all(pendingList.map(async ([pId, data]) => {
          try {
            const singleRes = await fetch('/api/admin/customer-pricing', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                customer_id: selectedCustomerId,
                product_id: pId,
                custom_price: data.custom_price,
                is_visible: data.is_visible
              })
            })
            if (singleRes.ok) {
              successCount++
              delete remainingEdits[pId]
            } else {
              failCount++
            }
          } catch {
            failCount++
          }
        }))

        setPendingEdits(remainingEdits)
        if (successCount > 0) {
          toast.success(`Saved ${successCount} products successfully`)
        }
        if (failCount > 0) {
          toast.error(`${failCount} product(s) failed to save`)
        }
        fetchPricing(selectedCustomerId)
      }
    } catch (e) {
      toast.error('Error saving bulk changes: ' + e.message)
    } finally {
      setBulkSaveLoading(false)
    }
  }

  const handleBulkApply = async () => {
    if (!selectedCustomerId) return
    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/customer-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          action_type: bulkAction,
          customer_id: selectedCustomerId,
          category_id: bulkCat === 'all' ? null : bulkCat,
          value: bulkValue,
          is_visible: bulkVisibility
        })
      })
      if (res.ok) {
        toast.success('Bulk pricing rules applied successfully')
        setPendingEdits({})
        fetchPricing(selectedCustomerId)
      } else {
        toast.error('Bulk update failed')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBulkLoading(false)
    }
  }

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId)

  const productsList = customerData?.products || []
  const categoriesList = Array.from(new Set(productsList.map(p => p.category_name))).filter(Boolean)

  const filteredProducts = productsList.filter(p => {
    const matchesSearch = p.product_name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = catFilter === 'all' || p.category_name === catFilter
    return matchesSearch && matchesCat
  })

  const pendingReqsCount = catalogRequests.filter(r => r.status === 'pending').length
  const pendingEditsCount = Object.keys(pendingEdits).length

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-accent" /> Customers & B2B Rate Cards
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Assign custom wholesale rate cards and control catalog product visibility per B2B client.
          </p>
        </div>

        {/* Tab switcher & Create Customer Button */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} className="rounded-2xl h-10 px-4 font-bold text-xs gold-gradient text-primary shadow-soft flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Create New Customer
          </Button>

          <div className="flex items-center gap-2 bg-secondary p-1 rounded-2xl border shrink-0">
            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'pricing' ? 'gold-gradient text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Catalog & Pricing
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition relative ${activeTab === 'requests' ? 'gold-gradient text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Access Requests
              {pendingReqsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white font-extrabold rounded-full animate-pulse">
                  {pendingReqsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('logins')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'logins' ? 'gold-gradient text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Client Logins ({customerLogins.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 2: ACCESS REQUESTS */}
      {activeTab === 'requests' && (
        <Card className="radius-xl shadow-soft">
          <CardContent className="p-6">
            <h2 className="font-display text-lg font-bold mb-4">Pending Catalog Access Requests</h2>
            {reqLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading requests...</div>
            ) : catalogRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">No catalog access requests found.</div>
            ) : (
              <div className="space-y-3">
                {catalogRequests.map(req => (
                  <div key={req.id} className="p-4 border rounded-2xl bg-secondary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{req.customer_name || req.name || 'Enterprise Client'}</p>
                        <Badge className={`text-[10px] uppercase ${req.status === 'pending' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' : req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.email || req.customer_email || '—'}{req.phone ? ` • Phone: ${req.phone}` : ''} • {new Date(req.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      {(req.message || req.note) && <p className="text-xs text-foreground/80 mt-2 bg-background p-2 rounded-lg border">{req.message || req.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' ? (
                        <>
                          <Button size="sm" onClick={() => handleApproveRequest(req)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-soft">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve & Unlock
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req)} className="text-destructive border-destructive/30 hover:bg-destructive/10 font-bold text-xs rounded-xl">
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs font-semibold">
                          {req.status === 'approved' ? '✓ Catalog Unlocked' : '✕ Request Rejected'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: CLIENT LOGINS */}
      {activeTab === 'logins' && (
        <Card className="radius-xl shadow-soft">
          <CardContent className="p-6">
            <h2 className="font-display text-lg font-bold mb-4">Customer Account Roster ({customerLogins.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Credentials</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customerLogins.map(c => {
                    const regDate = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                    const lastLogin = c.last_login_at ? new Date(c.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                    return (
                      <tr key={c.id} className="hover:bg-secondary/30 transition">
                        <td className="py-3 px-4 font-semibold text-foreground">{c.full_name}</td>
                        <td className="py-3 px-4 font-mono">{c.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">{c.phone || '—'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{regDate}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-accent font-bold">{lastLogin}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const autoPw = 'AK' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!'
                              try {
                                const res = await fetch('/api/admin/reset-password', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${localStorage.getItem('token')}`
                                  },
                                  body: JSON.stringify({ user_id: c.id, email: c.email, new_password: autoPw })
                                })
                                if (!res.ok) throw new Error('Failed to generate credentials')
                                const data = await res.json()
                                setCreatedCredentials({ ...data.user, role: 'customer' })
                                toast.success('Credentials ready to copy/share!')
                              } catch (err) {
                                toast.error(err.message)
                              }
                            }}
                            className="rounded-xl h-7 text-[11px] font-bold text-accent border-accent/30 hover:bg-accent/10 px-2.5"
                          >
                            <Key className="w-3 h-3 mr-1" /> Copy / Share Credentials
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 1: CATALOG & PRICING MANAGER */}
      {activeTab === 'pricing' && (
        <>
        {/* Customer Selector & Quick Info */}
        <Card className="radius-xl border shadow-soft bg-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1 w-full md:max-w-md">
                <label className="text-xs font-bold text-foreground mb-1.5 block">Select B2B Customer Account</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border font-semibold">
                    <SelectValue placeholder="Choose client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="font-bold">{c.full_name || 'Customer'}</span>
                        <span className="text-muted-foreground ml-2">({c.email})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCustomerObj && (
                <div className="flex items-center gap-3 bg-secondary/50 p-3 rounded-xl border w-full md:w-auto">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Selected Client</p>
                    <p className="text-sm font-bold text-foreground">{selectedCustomerObj.full_name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{selectedCustomerObj.email}</p>
                  </div>
                  <div className="ml-auto md:ml-4 text-right">
                    <Badge className="bg-emerald-500/20 text-emerald-600 font-extrabold px-2.5 py-1 text-xs">
                      Visible Products: {customerData?.assigned_count || 0} / {productsList.length}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Pricing Tool */}
            <div className="p-4 bg-secondary/30 rounded-2xl border space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <h3 className="font-bold text-xs uppercase tracking-wide text-foreground">Bulk Category Pricing & Visibility Tool</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Quickly grant access and set bulk markup percentages or fixed prices for all items in a category instead of doing 300+ products one by one.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Target Category</label>
                  <Select value={bulkCat} onValueChange={setBulkCat}>
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoriesList.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Pricing Rule</label>
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markup_percent">Percentage Markup (% over Default)</SelectItem>
                      <SelectItem value="discount_percent">Percentage Discount (% off Default)</SelectItem>
                      <SelectItem value="fixed_price">Fixed Set Price (₹ for all items)</SelectItem>
                      <SelectItem value="toggle_visibility">Toggle Visibility Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bulkAction !== 'toggle_visibility' && (
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Value (% or ₹)</label>
                    <Input
                      type="number"
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                      placeholder="10"
                      className="h-9 text-xs rounded-xl bg-background"
                    />
                  </div>
                )}

                <div className="flex items-end">
                  <Button
                    onClick={handleBulkApply}
                    disabled={bulkLoading || !selectedCustomerId}
                    className="w-full h-9 rounded-xl text-xs font-bold gold-gradient text-primary shadow-soft"
                  >
                    {bulkLoading ? 'Applying...' : 'Apply Bulk Rule'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Table Header Controls */}
        <Card className="radius-xl shadow-soft">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-10 rounded-xl text-xs"
                  />
                </div>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-44 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoriesList.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchPricing(selectedCustomerId, true)} disabled={loading} className="rounded-xl h-10">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </div>

            {/* Products Table */}
            {loading ? (
              <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                Loading pricing matrix...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">No products found matching filters.</div>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground uppercase font-bold text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Default Price</th>
                      <th className="py-3 px-4">Customer Custom Price</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProducts.map(p => {
                      const pending = pendingEdits[p.product_id]
                      return (
                        <ProductPricingRow
                          key={p.product_id}
                          product={p}
                          pendingEdit={pending}
                          onChange={(newPrice, newVis) => handleRowChange(p.product_id, newPrice, newVis)}
                          onSave={(newPrice, newVis) => handleSingleSave(p.product_id, newPrice, newVis)}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </CardContent>
        </Card>
        </>
      )}

      {/* Floating Fixed Bottom-Center Save All Bar — rendered via Portal to escape transformed ancestor */}
      {pendingEditsCount > 0 && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, width: '92%', maxWidth: '672px', pointerEvents: 'auto' }}
        >
          <div style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1010 100%)', color: '#fff', border: '2px solid hsl(38,72%,48%)', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', boxShadow: '0 20px 60px rgba(26,10,10,0.8), 0 0 30px rgba(212,147,26,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Gold pencil/edit icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(38,72%,48%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
              <div>
                <p style={{ fontWeight: 800, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <span>{pendingEditsCount} product{pendingEditsCount !== 1 ? 's' : ''} changed</span>
                  <span style={{ padding: '2px 8px', fontSize: '10px', background: 'linear-gradient(135deg, hsl(38,80%,55%), hsl(38,72%,42%))', color: '#1a0a0a', fontWeight: 900, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Unsaved
                  </span>
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '3px', margin: 0 }}>
                  Click <strong style={{ color: 'hsl(38,72%,55%)' }}>Save All</strong> to commit all updates at once.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setPendingEdits({})}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 700, padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              >
                ✕ Discard
              </button>
              <button
                type="button"
                disabled={bulkSaveLoading}
                onClick={handleSaveAll}
                style={{ background: 'linear-gradient(135deg, hsl(38,80%,55%) 0%, hsl(38,72%,42%) 100%)', color: 'hsl(0,55%,22%)', fontSize: '12px', fontWeight: 900, padding: '8px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px hsla(38,72%,50%,0.4)', transition: 'transform 0.2s', letterSpacing: '0.02em' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {bulkSaveLoading ? '⟳ Saving All...' : `Save All (${pendingEditsCount})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Create Account Dialog (Customer or Vendor) */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md radius-xl p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" /> {newCustForm.role === 'vendor' ? 'Create New Vendor Account' : 'Create New Customer Account'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4 text-left mt-2">
            <div>
              <label className="text-xs font-bold block mb-1">Account Type *</label>
              <select
                value={newCustForm.role}
                onChange={e => setNewCustForm({ ...newCustForm, role: e.target.value })}
                className="w-full h-10 rounded-xl text-xs bg-card border border-border px-3 font-bold text-foreground focus:ring-accent"
              >
                <option value="customer">👥 B2B Customer Account</option>
                <option value="vendor">🚚 Vendor / Logistics Partner Account</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">{newCustForm.role === 'vendor' ? 'Vendor / Company Name *' : 'Full Name / Business Name *'}</label>
              <Input
                required
                placeholder={newCustForm.role === 'vendor' ? 'e.g. Swift Delivery or BlueDart' : 'e.g. Ayan Shaikh or Acme Corp'}
                value={newCustForm.full_name}
                onChange={e => setNewCustForm({ ...newCustForm, full_name: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Email Address *</label>
              <Input
                required
                type="email"
                placeholder={newCustForm.role === 'vendor' ? 'vendor@logistics.com' : 'client@company.com'}
                value={newCustForm.email}
                onChange={e => setNewCustForm({ ...newCustForm, email: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Phone Number (WhatsApp)</label>
              <Input
                placeholder="+91 9876543210"
                value={newCustForm.phone}
                onChange={e => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold block">Access Password *</label>
                <button
                  type="button"
                  onClick={() => {
                    const prefix = newCustForm.role === 'vendor' ? 'VND' : 'AK'
                    const autoPw = prefix + Math.random().toString(36).substring(2, 8).toUpperCase() + '!'
                    setNewCustForm({ ...newCustForm, password: autoPw })
                  }}
                  className="text-[11px] text-accent font-bold hover:underline"
                >
                  ⚡ Auto-Generate
                </button>
              </div>
              <PasswordInput
                required
                placeholder="••••••••"
                value={newCustForm.password}
                onChange={e => setNewCustForm({ ...newCustForm, password: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <Button type="submit" disabled={creatingCust} className="w-full h-11 rounded-full gold-gradient text-primary font-bold text-xs mt-4">
              {creatingCust ? 'Creating Account...' : (newCustForm.role === 'vendor' ? 'Create Vendor Account' : 'Create Customer Account')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Created Credentials Modal with Copy & WhatsApp Share */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-md radius-xl p-6 text-left">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" /> {createdCredentials?.role === 'vendor' ? 'Vendor Account Created' : 'Customer Account Created'}
            </DialogTitle>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 mt-2">
              <p className="text-xs text-muted-foreground">
                Share these login credentials directly with <strong>{createdCredentials.full_name}</strong> via WhatsApp or Email:
              </p>

              <div className="bg-secondary/40 p-4 rounded-2xl border space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Account Name</span>
                  <span className="font-bold text-foreground">{createdCredentials.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Login URL</span>
                  <span className="font-mono font-bold text-accent">
                    {typeof window !== 'undefined' ? `${window.location.origin}${createdCredentials.role === 'vendor' ? '/vendor/login' : '/login'}` : (createdCredentials.role === 'vendor' ? '/vendor/login' : '/login')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Email Address</span>
                  <span className="font-mono font-bold text-foreground">{createdCredentials.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Temporary Password</span>
                  <span className="font-mono font-bold text-accent">{createdCredentials.temporary_password}</span>
                </div>
                {createdCredentials.phone && (
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Phone Number</span>
                    <span className="font-mono font-bold text-foreground">{createdCredentials.phone}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => {
                    const loginUrl = `${window.location.origin}${createdCredentials.role === 'vendor' ? '/vendor/login' : '/login'}`
                    const text = createdCredentials.role === 'vendor'
                      ? `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Vendor Fulfillment Account has been created!\n\nVendor Portal Login: ${loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to access assigned delivery orders and stock inventory.`
                      : `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Customer Account has been created!\n\nWebsite Login: ${loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to view your assigned product catalog and custom pricing.`
                    navigator.clipboard.writeText(text)
                    setCopied(true)
                    toast.success('Credentials copied to clipboard!')
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  variant="outline"
                  className="rounded-xl h-11 text-xs font-bold"
                >
                  {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copied ? 'Copied!' : 'Copy Credentials'}
                </Button>

                <Button
                  onClick={() => {
                    const loginUrl = `${window.location.origin}${createdCredentials.role === 'vendor' ? '/vendor/login' : '/login'}`
                    const text = createdCredentials.role === 'vendor'
                      ? `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Vendor Fulfillment Account has been created!\n\nVendor Portal Login: ${loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to access assigned delivery orders and stock inventory.`
                      : `Hello ${createdCredentials.full_name},\n\nYour AK Enterprises Customer Account has been created!\n\nWebsite Login: ${loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\n\nPlease sign in to view your assigned product catalog and custom pricing.`
                    const phone = createdCredentials.phone?.replace(/[^0-9]/g, '')
                    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
                    window.open(url, '_blank')
                  }}
                  className="rounded-xl h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Share WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProductPricingRow({ product, pendingEdit, onChange, onSave }) {
  const getProductImage = () => {
    if (product.image_url) return product.image_url
    if (product.images && product.images.length > 0 && product.images[0]) return product.images[0]
    return '/placeholder-product.png'
  }

  const [imgSrc, setImgSrc] = useState(getProductImage())

  // Effective state: if there is a pending edit in parent, use it; otherwise use product data
  const currentPrice = pendingEdit !== undefined ? pendingEdit.custom_price : product.custom_price
  const currentVis = pendingEdit !== undefined ? pendingEdit.is_visible : product.is_visible
  const isDirty = pendingEdit !== undefined

  const [price, setPrice] = useState(currentPrice)
  const [visible, setVisible] = useState(currentVis)

  useEffect(() => {
    setImgSrc(getProductImage())
    setPrice(currentPrice)
    setVisible(currentVis)
  }, [product, pendingEdit, currentPrice, currentVis])

  const handlePriceChange = (val) => {
    setPrice(val)
    onChange(val, visible)
  }

  const handleVisibilityToggle = (val) => {
    setVisible(val)
    onChange(price, val)
  }

  const save = () => {
    onSave(price, visible)
  }

  return (
    <tr className={`transition ${isDirty ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500' : visible ? 'hover:bg-secondary/30' : 'opacity-60 bg-secondary/10'}`}>
      <td className="py-3 px-4 font-semibold text-foreground">
        <div className="flex items-center gap-3">
          <img
            src={imgSrc}
            alt={product.product_name || 'Product'}
            onError={() => setImgSrc('/placeholder-product.png')}
            className="w-10 h-10 object-cover rounded-lg shrink-0 border bg-secondary/20 shadow-sm"
          />
          <div>
            <div className="font-semibold text-foreground leading-snug flex items-center gap-2">
              <span>{product.product_name}</span>
              {isDirty && (
                <span className="px-1.5 py-0.5 text-[9px] bg-amber-500 text-white font-extrabold rounded-md uppercase tracking-wider animate-pulse">
                  Unsaved
                </span>
              )}
            </div>
            {product.is_overridden && !isDirty && (
              <span className="inline-block mt-0.5 text-[9px] bg-accent/20 text-accent font-bold px-1.5 py-0.5 rounded">Custom Rate</span>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-muted-foreground">{product.category_name}</td>
      <td className="py-3 px-4 font-mono font-medium text-muted-foreground">{formatINR(product.default_price)}</td>
      <td className="py-3 px-4">
        <div className="relative max-w-[130px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input
            type="number"
            value={price}
            onChange={e => handlePriceChange(e.target.value)}
            className={`pl-6 h-8 text-xs rounded-lg font-mono font-bold ${isDirty ? 'border-amber-500 ring-1 ring-amber-500/50 bg-background' : ''}`}
          />
        </div>
      </td>
      <td className="py-3 px-4">
        <button
          type="button"
          onClick={() => {
            const nextVis = !visible
            setVisible(nextVis)
            onChange(price, nextVis)
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer select-none ${
            visible ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/25' : 'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25'
          }`}
        >
          {visible ? <><Eye className="w-3.5 h-3.5" /> Visible</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
        </button>
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          size="sm"
          disabled={!isDirty}
          onClick={save}
          className={`h-8 rounded-lg text-xs font-semibold px-3 ${isDirty ? 'gold-gradient text-primary font-bold shadow-soft' : ''}`}
        >
          <Save className="w-3 h-3 mr-1" /> Save
        </Button>
      </td>
    </tr>
  )
}
