import { runReport } from '../lib/reports/query-service.js'
import { buildWorkbook, reportFileName } from '../lib/reports/excel.js'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: admin } = await sb.from('users').select('id,email,role').eq('role','admin').limit(1).maybeSingle()
const user = { id: admin.id, email: admin.email, role: 'admin', full_name: 'AK Admin' }

const res = await runReport(user, { range: 'last-30-days', group_by: 'day' })
const r = res.ok ? res.data : res
console.log('summary.orders:', r.summary.totalOrders, '| net:', r.summary.netRevenue, '| gst:', r.summary.totalGST)
console.log('reconciliation:', JSON.stringify(r.reconciliation))
console.log('HSN sample from details:', r.orderDetails.slice(0,3).map(l=>l.hsn_code), '| distinct hsns:', new Set(r.orderDetails.map(l=>l.hsn_code)).size)

const buf = await buildWorkbook(r)
writeFileSync('test-xlsx-output.xlsx', buf)
console.log('workbook bytes:', buf.length, '| filename:', reportFileName(r.meta.zoneName))

const wb2 = XLSX.read(buf, { type: 'buffer' })
console.log('SHEETS:', wb2.SheetNames.join(', '))
const ws = wb2.Sheets[wb2.SheetNames[0]]
console.log('Summary rows:', JSON.stringify(XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0,6)))
