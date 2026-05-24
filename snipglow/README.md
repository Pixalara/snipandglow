# SnipandGlow — Salon Management Software

WhatsApp-native salon management platform built for Indian salons. Manage appointments, billing, customers, staff, and grow your business on autopilot.

## Product

**Live:** https://snipandglow.com

### Plans

| Plan | Price | Includes |
|---|---|---|
| **Essentials** | ₹799/month | Appointments, billing, staff, CRM, WhatsApp automation (shared number), analytics |
| **Growth** | ₹1,499/month | Everything in Essentials + own WhatsApp Business API (free setup ₹5,500 value), 2 branches, +₹499/branch, marketing broadcasts, multi-branch management |

Both plans: billed yearly · 15-day free trial · cancel anytime

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth (Google OAuth + Email)
- **Hosting:** Vercel
- **WhatsApp:** Meta Cloud API (WhatsApp Business Platform)
- **Payments:** Razorpay
- **UI:** Tailwind CSS v4 + shadcn/ui

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.local` for required variables (Supabase, Meta WhatsApp, Razorpay, etc.)

## Key Features

- WhatsApp booking flow (Meta Flows API)
- Automated reminders, receipts, feedback collection
- Win-back campaigns (30-day + 60-day)
- GST billing & digital invoices
- Loyalty tiers (New → Regular → Silver → Gold → VIP)
- Revenue dashboard with CSV export
- Multi-branch support
- Booking capacity settings (max appointments per slot)
- Admin panel for platform management

## Built by

[Pixalara LLP](https://pixalara.io) — A DPIIT Recognized Technology Company
