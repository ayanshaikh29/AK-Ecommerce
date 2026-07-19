# Lumière — Premium E-Commerce MVP

## Vision
Single-brand premium e-commerce store (Flipkart/Amazon/Myntra-inspired) for 300–400 products, with COD as the only payment method (isolated field for future gateway).

## Stack
- Next.js 15 (App Router) + Tailwind + shadcn/ui + Framer Motion + Sonner
- MongoDB (native driver) for data
- Auth: HMAC-signed JWT tokens in localStorage
- Deploy: Vercel-ready (single Next.js app, no external services required)

## Features Built (MVP)
### Customer
- Home: sliding hero, category grid, trending, featured, promo strip, newsletter, WhatsApp float
- Products listing: category / price / sort filters, search, mobile bottom-sheet filters, skeleton loaders
- Product detail: image gallery, ratings, stock urgency, quantity, Add to Cart, Buy Now, tabs (desc/specs/reviews), related products
- Cart drawer + cart page + checkout (address + COD) + order success
- Auth: signup/login (email + password)
- My Orders with visual status stepper (pending → confirmed → packed → shipped → delivered)
- Reviews: logged-in users can post; rating aggregates auto-update

### Admin
- Auth-gated admin panel (role check on load, not just at login)
- Dashboard: product/order/user counts, revenue, pending orders, low-stock alerts, 7-day orders bar chart
- Products: table with search, edit/delete, toggle active
- Product form: create/edit with images, category, stock, featured flag
- CSV bulk import (client-side parse + preview + bulk insert)
- Orders: filter by status, view details, update status

## Seed Data
- Admin: `admin@store.com` / `Admin@123`
- 6 categories, 15 products with images from Unsplash

## Design
- Fonts: Fraunces (serif headings) + Inter (body)
- Palette: ivory background, charcoal primary, gold accent
- Micro-interactions, skeleton loaders, scroll-reveal animations
