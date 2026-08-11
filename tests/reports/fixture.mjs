// Shared deterministic fixture for report tests (no database required).
import { buildReport } from '../../lib/reports/aggregation.js'
import { normalizeFilters } from '../../lib/reports/filters.js'

export const categories = [
  { id: 'c1', name: 'Stationery' },
  { id: 'c2', name: 'Housekeeping' }
]

export const products = [
  { id: 'p1', name: 'Pen Box', sku: 'SKU1', hsn_code: '4820', gst_percent: 12, mrp: 120, price: 100, unit: 'NOS', category_id: 'c1', description: 'pen' },
  { id: 'p2', name: 'Cleaning Liquid', sku: 'SKU2', hsn_code: '3402', gst_percent: 18, mrp: 220, price: 200, unit: 'NOS', category_id: 'c2', description: 'clean' }
]

const NAMES = { p1: 'Pen Box', p2: 'Cleaning Liquid' }
const addr = (state) => ({ full_name: 'Test Customer', phone: '9000000000', line1: 'A', line2: '', city: 'Pune', state, pincode: '411001', gst: null })
const cust = (name) => ({ id: name, email: name + '@x.com', full_name: 'Test Customer', phone: '9000000000', gst_number: null, company_name: 'ACME', business_name: null, city: 'Pune', state: 'Maharashtra', pincode: '411001' })
const item = (product_id, quantity, price_snapshot) => ({ id: product_id + '-' + quantity, product_id, product_name_snapshot: NAMES[product_id] || product_id, price_snapshot: price_snapshot, quantity, variant_id: null })

export const orders = [
  {
    id: 'o1', order_number: 'AK0001', status: 'delivered', payment_status: 'Paid', payment_method: 'COD',
    user_id: 'u1', placed_at: '2026-08-01T04:30:00Z', updated_at: '2026-08-01T04:30:00Z', created_at: '2026-08-01T04:30:00Z',
    subtotal: 400, discount: 0, shipping_fee: 150, total: 550, addresses: addr('Maharashtra'),
    users: cust('u1'), vendors: null, order_items: [item('p1', 2, 100), item('p2', 1, 200)]
  },
  {
    id: 'o2', order_number: 'AK0002', status: 'cancelled', payment_status: 'Pending', payment_method: 'COD',
    user_id: 'u2', placed_at: '2026-08-02T04:30:00Z', updated_at: '2026-08-02T04:30:00Z', created_at: '2026-08-02T04:30:00Z',
    subtotal: 100, discount: 0, shipping_fee: 0, total: 100, addresses: addr('Karnataka'),
    users: cust('u2'), vendors: null, order_items: [item('p1', 1, 100)]
  },
  {
    id: 'o3', order_number: 'AK0003', status: 'delivered', payment_status: 'Paid', payment_method: 'COD',
    user_id: 'u1', placed_at: '2026-08-05T04:30:00Z', updated_at: '2026-08-05T04:30:00Z', created_at: '2026-08-05T04:30:00Z',
    subtotal: 600, discount: 0, shipping_fee: 0, total: 600, addresses: addr('Maharashtra'),
    users: cust('u1'), vendors: null, order_items: [item('p2', 3, 200)]
  },
  {
    id: 'o4', order_number: 'AK0004', status: 'pending', payment_status: 'Pending', payment_method: 'COD',
    user_id: 'u3', placed_at: '2026-08-10T04:30:00Z', updated_at: '2026-08-10T04:30:00Z', created_at: '2026-08-10T04:30:00Z',
    subtotal: 100, discount: 0, shipping_fee: 0, total: 100, addresses: addr('Maharashtra'),
    users: cust('u3'), vendors: null, order_items: [item('p1', 1, 100)]
  }
]

export const firstOrderByUser = { u1: '2026-08-01T04:30:00Z', u2: '2026-08-02T04:30:00Z', u3: '2026-08-10T04:30:00Z' }

export function makeReport(filtersOverride = {}) {
  const filters = normalizeFilters({ range: 'custom', start_date: '2026-08-01', end_date: '2026-08-31', ...filtersOverride })
  const scope = { isOwner: true, zoneId: '', zoneName: 'All Zones' }
  return buildReport({ orders, allProducts: products, categories, firstOrderByUser, filters, scope })
}
