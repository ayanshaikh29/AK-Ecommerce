/**
 * Centralized Status Label Mapping
 *
 * Maps database status keys to human-readable UI labels.
 * All UI-facing status text should go through this module
 * to ensure consistency across the entire app.
 *
 * Database keys remain unchanged (e.g., 'pending_vendor_acceptance'),
 * but display text uses "Zonal Admin" instead of "Vendor".
 */

const STATUS_LABELS = {
  // New flow
  pending_vendor_acceptance: 'Pending Zonal Admin Acceptance',
  vendor_accepted_pending_admin_approval: 'Zonal Admin Accepted — Pending Owner Approval',
  pending_admin_approval: 'Pending Owner Approval',
  admin_rejected: 'Rejected by Owner',
  admin_confirmed: 'Confirmed by Owner',

  // Confirmed & fulfillment
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',

  // Legacy flow
  pending: 'Pending',
  vendor_assigned: 'Zonal Admin Assigned',
  vendor_accepted: 'Zonal Admin Accepted',
  vendor_rejected: 'Zonal Admin Rejected',

  // Other
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  returned: 'Returned',
  accepted: 'Accepted',
  processing: 'Processing',
  completed: 'Completed',
}

/**
 * Get human-readable label for a status key.
 * Falls back to title-cased key if no mapping found.
 */
export function getStatusLabel(statusKey) {
  if (!statusKey) return 'Unknown'
  const key = statusKey.toLowerCase().trim()
  if (STATUS_LABELS[key]) return STATUS_LABELS[key]
  // Fallback: replace underscores and capitalize
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Get CSS badge class for a status key.
 */
export function getStatusBadgeClass(statusKey) {
  const key = (statusKey || '').toLowerCase().trim()
  const classes = {
    pending_vendor_acceptance: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    vendor_accepted_pending_admin_approval: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    pending_admin_approval: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    admin_rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
    admin_confirmed: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    confirmed: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    packed: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    shipped: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    out_for_delivery: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    delivered: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    vendor_assigned: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    vendor_accepted: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    vendor_rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
    cancelled: 'bg-gray-500/10 text-gray-600 border border-gray-500/20',
    rejected: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
    returned: 'bg-orange-500/10 text-orange-600 border border-orange-500/20',
    accepted: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    processing: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  }
  return classes[key] || 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
}

/**
 * Simple helper: replace underscores with spaces and capitalize (legacy).
 * Prefer getStatusLabel() for new code.
 */
export function formatStatus(statusKey) {
  return getStatusLabel(statusKey)
}

/**
 * Short label for buttons — keeps labels compact to prevent text overlap.
 * Use this in grids/buttons where space is limited.
 */
const STATUS_SHORT_LABELS = {
  pending_vendor_acceptance: 'Awaiting Acceptance',
  vendor_accepted_pending_admin_approval: 'Awaiting Approval',
  pending_admin_approval: 'Awaiting Approval',
  admin_rejected: 'Rejected',
  admin_confirmed: 'Confirmed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  pending: 'Pending',
  vendor_assigned: 'Zonal Admin Assigned',
  vendor_accepted: 'Accepted',
  vendor_rejected: 'Rejected',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  returned: 'Returned',
  accepted: 'Accepted',
  processing: 'Processing',
  completed: 'Completed',
}

export function getStatusShortLabel(statusKey) {
  if (!statusKey) return 'Unknown'
  const key = statusKey.toLowerCase().trim()
  return STATUS_SHORT_LABELS[key] || getStatusLabel(statusKey)
}

export default STATUS_LABELS
