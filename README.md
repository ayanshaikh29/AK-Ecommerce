# AK-Ecommerce

A production-focused B2B ecommerce platform for **AK Enterprises**, built with Next.js and Supabase.

## Highlights

- B2B product catalog with auth-gated access
- Customer flows: product browsing, cart, checkout, order tracking
- Owner/Admin and Zonal Vendor portals
- GST-aware billing/reporting and downloadable Excel exports
- Supabase-backed APIs, auth, and realtime-driven admin updates

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 18, Tailwind CSS
- **Backend/API:** Next.js API routes
- **Data/Auth:** Supabase
- **Reporting:** ExcelJS

## Project Structure

- `/app` — routes, pages, and API handlers
- `/components` — reusable UI and view-level components
- `/lib` — business logic, integrations, and helpers
- `/tests` — automated report tests
- `/public` — static assets

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env.local` file and add at least:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3) Run locally

```bash
npm run dev
```

Open: `http://localhost:3000`

## Available Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm test` — run report-focused test suite

## Reports Documentation

Detailed reporting formulas, reconciliation rules, Excel output details, and deployment notes are documented in:

- [`REPORTING.md`](./REPORTING.md)

## Demo / Screenshots

For a professional repository profile, add:

- Live demo URL (Vercel or equivalent)
- 2–4 screenshots (home, product listing, admin/reports)
- Short architecture/system diagram

## Contributing

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening pull requests.
