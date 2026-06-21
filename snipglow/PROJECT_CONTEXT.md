# SnipandGlow — Full Project Context

## Overview
SnipandGlow is an all-in-one salon and spa management SaaS platform built for Indian businesses. It handles appointments, billing, customer management, staff scheduling, WhatsApp automation, analytics, and more.

**Domain:** snipandglow.com  
**Company:** Pixalara LLP (DPIIT Recognized)  
**Supabase Project ID:** ndnigqeucfdeimlwevsr  
**Hosting:** Vercel (auto-deploy from GitHub main branch)  
**Repository:** github.com/Pixalara/snipandglow  
**Branch:** main (push directly, no PRs)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, tw-animate-css |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth + OTP) |
| State | React Server Components + Server Actions |
| Charts | Recharts (lazy-loaded) |
| Icons | Lucide React |
| Themes | next-themes (dark/light mode) |
| Forms | React Hook Form + Zod |
| Deployment | Vercel (Edge Functions for middleware) |
| Speed Insights | @vercel/speed-insights |

---

## Project Structure

```
d:\Snip and Glow\snipandglow\snipglow\
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              — Dashboard shell (auth + subscription guard)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx            — Main dashboard (KPI cards, quick actions)
│   │   │       ├── appointments/       — Booking, reschedule, complete & bill
│   │   │       ├── billing/            — Invoices, POS billing with discounts
│   │   │       ├── customers/          — Customer CRUD, membership assignment
│   │   │       ├── services/           — Service management
│   │   │       ├── staff/              — Employee management
│   │   │       ├── memberships/        — Membership plan CRUD
│   │   │       ├── expenses/           — Expense tracker
│   │   │       ├── payroll/            — Staff salary management
│   │   │       ├── leads/              — Lead pipeline & conversion
│   │   │       ├── branches/           — Multi-branch (Enterprise only)
│   │   │       ├── analytics/          — Revenue, expenses, appointments charts
│   │   │       ├── whatsapp/           — WhatsApp Business API connect
│   │   │       ├── feedback/           — Customer feedback (WhatsApp-based)
│   │   │       ├── support/            — Help & Support ticket system
│   │   │       ├── audit-log/          — Activity audit trail
│   │   │       └── settings/           — Salon profile, GST, discount, QR code, subscription
│   │   ├── (legal)/
│   │   │   ├── blog/                   — Blog listing + [slug] detail pages
│   │   │   ├── privacy/               — Privacy policy
│   │   │   ├── terms/                 — Terms & conditions
│   │   │   └── refund/               — Refund policy
│   │   ├── page.tsx                    — Landing page (homepage)
│   │   ├── layout.tsx                  — Root layout (fonts, metadata, SEO)
│   │   ├── sitemap.ts                  — Dynamic sitemap generation
│   │   ├── robots.ts                   — Robots.txt
│   │   ├── login/                      — Login page
│   │   ├── signup/                     — Signup page
│   │   ├── verify-otp/                — OTP verification
│   │   └── onboarding/               — Tenant/branch setup after signup
│   ├── components/
│   │   ├── app-shell.tsx              — Dashboard layout wrapper
│   │   ├── sidebar.tsx                — Navigation sidebar
│   │   ├── topbar.tsx                 — Top bar (branch switcher, theme, logout)
│   │   ├── subscription-guard.tsx     — Locks features when subscription expired
│   │   ├── data-table.tsx             — Reusable responsive table (card view on mobile)
│   │   ├── brand-logo.tsx             — Brand logo component
│   │   └── ui/                        — Button, Input, Card, Modal components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts              — Server-side Supabase client (with cookies)
│   │   │   ├── admin.ts               — Admin client (service_role, singleton cached)
│   │   │   └── client.ts              — Browser-side Supabase client
│   │   ├── utils.ts                   — formatINR, formatDateIN, calculateInvoiceTotal
│   │   └── permissions.ts            — Role-based access control (can function)
│   ├── types/
│   │   ├── database.ts               — All TypeScript interfaces
│   │   └── database.types.ts         — Supabase generated types
│   ├── data/
│   │   └── blog-posts.json           — 20 SEO blog posts
│   └── middleware.ts                  — Auth middleware (edge, fast path for public routes)
├── supabase/
│   └── migrations/
│       ├── 010_expenses_payroll.sql   — Expenses & payroll tables
│       ├── 011_leads.sql              — Leads table
│       ├── 012_feedback.sql           — Feedback table
│       └── 013_support_tickets.sql    — Support tickets table
├── next.config.ts                     — Next.js config (optimizations, headers)
├── package.json
└── public/                            — Favicon, OG image, manifest, robots
```

---

## Key Architecture Decisions

### 1. Admin Client Pattern
- `createAdminClient()` uses `service_role` key to bypass RLS
- Cached as module-level singleton (no per-request overhead)
- Used for: expenses, payroll, leads, feedback, support tickets, analytics, membership operations
- Regular `createClient()` used for auth-scoped operations (appointments, invoices, customers)

### 2. Server Components + Server Actions
- Pages are Server Components (fetch data on server)
- Interactive parts extracted into `'use client'` components (e.g., `appointments-client.tsx`)
- Never pass render functions across RSC boundary — extract into dedicated client components

### 3. Subscription & Plan Model
- **Essentials Plan:** ₹999/mo — All features for single-location salons
- **Enterprise Plan:** Custom pricing — Multi-branch management, dedicated RM
- Subscription status: `trial` → `active` → `expired`/`cancelled`
- Feature locking: When expired, only `/dashboard` and `/dashboard/settings` accessible
- `SubscriptionGuard` component wraps all dashboard children

### 4. Branches Visibility
- "Branches" sidebar link only visible for `enterprise` plan users
- `planTier` passed from layout → AppShell → Sidebar

### 5. Discount System (Additive)
- Membership discount (auto-applied from customer's active membership)
- Additional discount (manual, added on top)
- Total = Membership % + Additional % (capped at 100%)
- Works in both: Complete & Bill (appointments) AND direct billing

### 6. Performance Optimizations
- Middleware: Zero-cost for public routes (no Supabase client created)
- Parallel queries with `Promise.all()` everywhere
- `loading.tsx` skeletons for all dashboard pages
- Lazy-loaded Recharts via `next/dynamic`
- `optimizePackageImports` for lucide-react, recharts, date-fns
- Preconnect to Supabase in root layout
- DB indexes on tenant_id + branch_id composites

---

## Database Tables

| Table | Purpose |
|-------|---------|
| tenants | Salon business entities (subscription, plan, settings) |
| branches | Physical locations |
| employees | Staff members (auth_user_id linked) |
| customers | Client database |
| services | Salon offerings (name, price, duration) |
| appointments | Bookings (status machine: booked→confirmed→completed/cancelled) |
| invoices | Bills (subtotal, discount, GST, total, payment status) |
| invoice_items | Line items per invoice |
| memberships | Membership plans (price, validity, discount_pct) |
| customer_memberships | Active membership assignments |
| expenses | Business expenses (excluding salaries) |
| payroll | Monthly salary records |
| leads | Potential customers pipeline |
| feedback | Customer ratings via WhatsApp (ready, not yet active) |
| support_tickets | Help & support tickets |
| analytics_snapshots | Pre-aggregated stats (not used — analytics is real-time now) |
| audit_logs | Activity trail |
| whatsapp_sessions | Message tracking |
| otp_codes | OTP verification |

---

## Important Patterns & Conventions

### File Writing
- Write files WITHOUT BOM: use `[System.IO.File]::WriteAllBytes` with `UTF8.GetBytes` if needed
- The active Next.js app is at `d:\Snip and Glow\snipandglow\snipglow\` (NOT the `frontend/` folder)

### Type Assertions
- Use `as any` for tables not in generated types (expenses, payroll, leads, feedback, support_tickets)
- Example: `admin.from('expenses' as any).select(...)`

### Git Workflow
- Push directly to `main` branch
- Build command: `npm run build` in the `snipglow` directory
- Auto-deploys to Vercel on push

### Multi-Service Appointments
- `whatsapp_flow_ref` field stores extra service IDs as JSON array
- Primary service in `service_id`, all services in `whatsapp_flow_ref`

### Billing Flow
- Direct billing: `/dashboard/billing/new` — select customer, add services/memberships, apply discount
- Appointment billing: Complete & Bill modal — auto-fetches services from appointment, auto-applies membership discount

### Landing Page
- Single-page with sections: Hero, How It Works, ROI, Features, Pricing, WhatsApp API add-on, CTA, FAQ, Book Demo, Footer
- Smooth scroll reveal animations (blur + translateY)
- WhatsApp phone mockup with auto-scrolling conversation showing full booking flow
- Floating WhatsApp button (bouncing animation) → connects to sales team (9988688654)
- Two pricing plans: Essentials (₹999/mo) + Enterprise (Custom)
- WhatsApp API add-on: ₹2,500 one-time setup, no markup fees

### SEO
- 20 blog posts in `src/data/blog-posts.json`
- Dynamic sitemap at `/sitemap.xml`
- Structured data (SoftwareApplication schema)
- OG image, favicon, PWA manifest configured
- Domain: snipandglow.com

### External Integrations
- Web3Forms (key: `9b7f9972-8fc2-468f-80a6-029eb5af4a91` → snipandglow.sales@pixalara.com) — Demo bookings + Support ticket notifications
- Supabase Auth — Google OAuth
- WhatsApp Business API — Ready for integration (Meta Embedded Signup flow built)
- QR Code Generator — Links to qrcode.pixalara.io

---

## What's NOT Yet Implemented (Future Work)

1. **WhatsApp API actual integration** — UI is built (connect flow, feedback page), but actual message sending not connected
2. **Payment gateway (Razorpay)** — Package installed, not integrated for subscription payments
3. **PDF invoice generation** — @react-pdf/renderer installed, not wired up
4. **Email notifications** — Only Web3Forms email for demo/support
5. **Google review automation** — Feedback page ready, auto-redirect to Google not built
6. **Inventory management** — Not implemented
7. **Online booking portal** — Public-facing booking page for customers not built
8. **Staff commission tracking** — Not implemented
9. **Razorpay subscription billing** — Auto-renewal not connected

---

## Social Media Links
| Platform | URL |
|----------|-----|
| LinkedIn | https://www.linkedin.com/company/pixalara/ |
| X (Twitter) | https://x.com/pixalara |
| Instagram | https://www.instagram.com/pixalara/ |
| YouTube | https://www.youtube.com/@pixalara |

---

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=https://ndnigqeucfdeimlwevsr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXT_PUBLIC_FB_APP_ID=<facebook_app_id>
NEXT_PUBLIC_FB_CONFIG_ID=<facebook_config_id>
```

---

## SQL Migrations to Run
If starting fresh, run these in Supabase SQL Editor in order:
1. `010_expenses_payroll.sql`
2. `011_leads.sql`
3. `012_feedback.sql`
4. `013_support_tickets.sql`

Also run the performance indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_branch ON appointments(tenant_id, branch_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_branch ON invoices(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_branch ON customers(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_active ON customer_memberships(customer_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_services_tenant_active ON services(tenant_id, branch_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_employees_tenant_active ON employees(tenant_id, branch_id) WHERE is_active = true;
```
