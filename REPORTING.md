# AK Enterprises — Excel Report System (Calculation & Deployment Reference)

This document defines exactly how every report number is calculated, how to
migrate, test, and deploy the feature. It is the single source of truth for the
reporting maths so preview and Excel can never disagree.

---

## 1. Architecture

```
Owner / Zonal Admin UI (ReportsView.jsx)
        │  fetch /api/reports/orders/preview?…   fetch /api/reports/orders/export?…
        ▼
app/api/reports/[[...path]]/route.js   (auth + role guard + zone guard)
        │
        ▼
lib/reports/filters.js        validate/normalize filters (IST, whitelists, presets)
lib/reports/permissions.js    resolve scope (owner=all, zonal admin=their vendor)
lib/reports/query-service.js  one PostgREST query, DB-level filtering, zone predicate
lib/reports/aggregation.js    ALL money math (single source of truth)
lib/reports/gst.js            report-time GST derivation (GST-inclusive prices)
lib/reports/excel.js          ExcelJS workbook builder (15 sheets)
lib/reports/history.js        report export history (optional table)
```

The **preview** and the **Excel export** call the same `getReport()` pipeline, so
their numbers are identical by construction.

---

## 2. Timezone & date-range behaviour

- All boundaries are computed in **Asia/Kolkata (IST, UTC+5:30, no DST)** via
  `lib/date-helpers.js`.
- Orders are stored as UTC ISO timestamps in `orders.placed_at`.
- The date filter is a **half-open range** applied to the DB:
  `placed_at >= startIST(00:00:00) AND placed_at < startIST(next day after end)`.
  This guarantees orders placed anywhere **on the end date** are included.
- Quick presets supported: today, yesterday, this-week, prev-week, this-month,
  prev-month, this-quarter, this-year, prev-year, last-7-days, last-30-days,
  last-90-days, all, custom.

## 3. Status inclusion / exclusion

| Group | Statuses | In revenue? |
|---|---|---|
| Delivered | `delivered` | ✅ |
| Shipped | `shipped`, `out_for_delivery` | ✅ |
| Processing | `confirmed`, `admin_confirmed`, `vendor_assigned`, `vendor_accepted`, `packed` | ✅ |
| Pending | `pending`, `pending_vendor_acceptance`, `pending_admin_approval`, `vendor_accepted_pending_admin_approval` | ✅ |
| **Excluded** | `cancelled`, `rejected`, `vendor_rejected`, `admin_rejected`, `returned` | ❌ |

Excluded orders still appear in **Order Details / Orders Summary / Order Status
Report** (flagged `Included in Revenue = No`), but never contribute to revenue,
product, category, customer, or date aggregates.

## 4. Money formulas (all GST-inclusive prices)

| Metric | Formula |
|---|---|
| **Gross Sales** | Σ (order-item `price_snapshot × quantity`) over included orders |
| **Taxable Amount** | Gross Sales − Total GST |
| **GST** | Per line: `taxable = incl / (1 + gst%/100)`, `tax = incl − taxable`. Same-state (Maharashtra) → CGST=SGST=half; other state → IGST=full. Uses **current** `products.gst_percent` (NOT a stored snapshot). |
| **Total Discounts** | Σ `orders.discount` (order-level). Item “MRP savings” `(mrp − price) × qty` are **informational only** — the selling price already reflects the discount, so they are never subtracted. |
| **Shipping** | Σ `orders.shipping_fee` |
| **Refunds / Returns** | 0 today; Returns value = Gross Sales of `returned` orders. Refunds = 0 until refund data exists. |
| **Net Revenue** | Gross Sales + Shipping − Discounts − Refunds − Returns value. **Reconciles exactly** with the Orders page (which sums `order.total` for non-cancelled; `total = Σ items + shipping − discount`). |
| **Average Order Value** | Net Revenue ÷ active (included) order count — labelled **net AOV**. |
| **Avg Items / Order** | Σ quantities ÷ active order count |
| **Avg Customer Order Value** | Net Revenue ÷ unique active customers |
| **Total Products Sold** | Σ item quantities (included orders) |
| **Delivered Products** | Σ quantities on orders with status `delivered` |
| **Customer Type** | New = first-ever order inside the period · Repeat = >1 order in period (or prior history) · Dormant = has orders before the period but none in it |

All money is rounded to **2 decimal places** with `round2()` at every boundary
(no float accumulation). `round2 = Math.round((n + EPSILON) * 100) / 100`.

## 5. Zone assignment

- A zone is the assigned **Zonal Admin (vendor)** record.
  `Zone Name = vendors.name`, `Zone ID = vendors.id` via `orders.assigned_vendor_id`.
- Orders with no assignment → zone `Unassigned`.
- Zonal Admins are forced (server-side, at the query) to `assigned_vendor_id = their vendor id`.
  A tampered `zone_id` in the URL/body/export is ignored.

## 6. Reconciliation

`reconciliation` is returned with every preview and written to the Sales Summary sheet:

- `reportOrders` (distinct orders) vs `ordersPageOrders` (Orders page count for the same filters)
- `reportNetRevenue` vs `ordersPageRevenue` (= Σ `order.total` for non-cancelled)
- If they differ beyond ₹0.99 the UI shows a **MISMATCH** warning and the workbook flags it —
  discrepancies are surfaced, never hidden.

## 7. API endpoints (`/api/reports/*`)

| Endpoint | Purpose |
|---|---|
| `GET /status` | Reference: statuses, quick presets, group-by options, zones, `is_owner`, current zone |
| `GET /zones` | Zone list for the Owner selector |
| `GET /orders/preview` | Full report JSON (KPIs + all slices + data quality + reconciliation) |
| `GET /orders/export` | Excel `.xlsx` download (logs to history) |
| `GET /sales/{summary,by-date,by-product,by-category,by-customer,by-location,payments,status,gst}` | Individual JSON slices |
| `GET /history` | Report export history (owner = all, vendor = own) |
| `GET /history/{id}` | One history record |
| `GET /download/{id}` | Re-generate + download a past report (ownership + 7-day expiry enforced) |

All endpoints: authenticate via Bearer token, allow `admin` + `vendor` only
(customers → 403), enforce zone scope server-side.

## 8. Excel workbook (15 sheets)

Sales Summary · Calculation Definitions · Order Details (76 cols, one row/item) ·
Orders Summary (one row/order, product names joined) · Products Sold · Sales by Date ·
Sales by Product · Sales by Category · Sales by Customer · Sales by Location ·
Payment Report · Order Status Report · GST Report · Data Quality · Notes.

- Freeze panes, autofilters, styled headers, alternating rows, currency/percent/
  date formats, negative amounts in red, totals rows, status conditional
  formatting, landscape print setup with repeated header rows.
- **Charts & slicers** are NOT native to ExcelJS → all charts render in the in-app
  preview; every sheet ships with autofilters (documented limitation).
- **Formula injection protection**: any cell beginning with `= + - @` is prefixed
  with `'` so imported text is never executed as a formula.
- File name: `AK_Enterprises_Order_Report_{Zone}_{YYYY-MM-DD_HH-mm}.xlsx`.

## 9. Migration (required once)

The report works with a **direct download** immediately. Report **history** needs
one table. Run in Supabase → SQL Editor:

```sql
-- content of schema-report-history.sql
```

(Only the `report_history` table — additive and reversible with `DROP TABLE
report_history;`. No changes to existing tables.)

## 10. Running tests

```bash
npm test                      # node --test tests/reports/*.test.mjs
```

Covers: filter presets + half-open end-date inclusion (IST), status/revenue
exclusion, multi-product non-duplication, product-name joining, GST CGST/SGST/IGST
math, discount handling, delivered quantity, reconciliation, Excel workbook opens
with all 15 sheets + required columns, and formula-injection protection.

## 11. Manual Excel check

1. Owner panel → **Sales Reports** → set a range → **Download Excel**.
2. Open in Microsoft Excel and LibreOffice: verify title block, 15 sheets,
   autofilters, freeze panes, and that **Sales Summary → Net Revenue** equals the
   Orders page total for the same period.
3. Zonal Admin panel → **Reports** tab → verify the workbook header says their zone
   and only their orders appear.

## 12. Deployment notes

- Add `exceljs` to `serverExternalPackages` (already in `next.config.js`).
- `maxDuration = 60` is set on the reports route (Hobby plan limit). For very
  large datasets, convert export to a background job (the history table already
  supports `queued/processing/completed/failed/expired`).
- No credentials are ever written into exported files.
- `scripts/test-report-pipeline.mjs` runs the full pipeline against live data
  (dev only; requires `.env`).
