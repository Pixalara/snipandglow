# Tech Stack — Salon SaaS (Complete Kiro Reference)

## Project Identity
- **Product**: WhatsApp-native Salon Management SaaS for India
- **Build mode**: Greenfield — empty folder, build everything from scratch
- **Developer**: Solo + Kiro AI
- **Target**: Indian salon owners, 1–5 branches, zero tech background

---

## 1. Frontend Framework

### Next.js 14 (App Router)
```
Version      : 14.x (latest stable)
Router       : App Router (NOT pages router)
Language     : TypeScript — strict mode ON
Rendering    : Server Components by default, Client Components only when needed
               ('use client' only for interactive UI, forms, hooks)
API Routes   : app/api/** for webhooks and server actions
Import alias : @/* maps to project root
```

**Install:**
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

**`next.config.js` settings:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}
module.exports = nextConfig
```

---

## 2. Styling

### Tailwind CSS
```
Version : 3.x (bundled with Next.js init)
Config  : tailwind.config.ts
Plugins : @tailwindcss/forms, @tailwindcss/typography
```

**`tailwind.config.ts`:**
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — salon premium feel
        brand: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        // WhatsApp green for UI accents
        wa: {
          green:   '#25d366',
          teal:    '#128c7e',
          dark:    '#075e54',
          light:   '#dcf8c6',
          bg:      '#ece5dd',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}
export default config
```

### shadcn/ui
```
Version    : latest
Style      : New York
Base color : Violet (matches brand palette)
CSS vars   : ON
```

**Init:**
```bash
npx shadcn-ui@latest init
```

**Install ALL these components upfront:**
```bash
npx shadcn-ui@latest add \
  button card table dialog form select badge tabs \
  input textarea label separator avatar dropdown-menu \
  sheet tooltip popover calendar command skeleton toast \
  progress switch radio-group checkbox scroll-area \
  alert alert-dialog accordion collapsible hover-card \
  navigation-menu pagination resizable slider sonner \
  toggle toggle-group
```

---

## 3. Database

### Supabase PostgreSQL
```
Platform       : Supabase (supabase.com)
DB engine      : PostgreSQL 15
Region         : ap-south-1 (Mumbai) — closest to India
Connection     : Supabase SDK + Prisma-style typed queries via generated types
Pooling        : Supabase built-in PgBouncer (use pooler URL for Edge Functions)
Extensions     : pg_cron, pg_net, uuid-ossp, pgcrypto (enable in Supabase dashboard)
```

**Install SDK:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Type generation (run after every schema change):**
```bash
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  --schema public \
  > types/database.types.ts
```

**`lib/supabase/client.ts`** (browser):
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase/server.ts`** (server components + API routes):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

**`lib/supabase/admin.ts`** (server-only, service role — never expose to client):
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

---

## 4. Authentication

### Supabase Auth
```
Providers  : Google OAuth (primary) + Custom WhatsApp OTP (secondary)
Sessions   : Supabase JWT, managed via SSR cookies
Role store : employees table (role column: owner | manager | staff)
```

**Enable in Supabase Dashboard:**
```
Authentication → Providers → Google → ON
  Client ID     : from Google Cloud Console
  Client Secret : from Google Cloud Console

Redirect URL (add to Google OAuth allowed):
  http://localhost:3000/auth/callback
  https://yourdomain.in/auth/callback
```

**Google OAuth trigger (client):**
```typescript
const supabase = createClient()
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { access_type: 'offline', prompt: 'consent' },
  },
})
```

**WhatsApp OTP — custom flow:**
```
Flow:
  1. User enters +91 phone number on login page
  2. POST /api/auth/send-otp
       → calls Supabase Edge Function: send-whatsapp-otp
       → generates 6-digit OTP
       → stores in whatsapp_sessions (expires 5 min)
       → sends via Meta WhatsApp template: otp_message
  3. User enters OTP in UI
  4. POST /api/auth/verify-otp
       → calls Supabase Edge Function: verify-whatsapp-otp
       → validates OTP + expiry
       → creates Supabase session via signInWithPassword
         (each employee has a system-generated email: {phone}@salon.internal)
       → returns session
  5. Client sets session → redirected to /dashboard
```

**`middleware.ts`** (root level):
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !user)
    return NextResponse.redirect(new URL('/login', request.url))

  if (pathname === '/login' && user)
    return NextResponse.redirect(new URL('/dashboard', request.url))

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
```

---

## 5. Storage

### Supabase Storage
```
Use case       : Invoice PDFs, salon logos, receipt attachments
Bucket         : invoices (private), assets (public)
Max file size  : 50MB per file
Pricing        : 1GB free, $0.021/GB after
```

**Bucket setup (run once in Supabase SQL editor):**
```sql
-- Public bucket for salon logos/assets
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true);

-- Private bucket for invoice PDFs (signed URLs for WhatsApp)
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false);

-- RLS: Only tenant members can read their own invoices
create policy "invoice_read" on storage.objects for select
using (
  bucket_id = 'invoices' and
  (storage.foldername(name))[1] = (
    select tenant_id::text from employees
    where auth_user_id = auth.uid() limit 1
  )
);

-- Service role can write invoices (Edge Function)
create policy "invoice_write" on storage.objects for insert
with check (bucket_id = 'invoices');
```

**Upload PDF from Edge Function:**
```typescript
const { error } = await supabaseAdmin.storage
  .from('invoices')
  .upload(
    `${tenantId}/${invoiceNumber}.pdf`,
    pdfBuffer,
    { contentType: 'application/pdf', upsert: true }
  )

// Get signed URL valid for 1 hour (for WhatsApp document message)
const { data } = await supabaseAdmin.storage
  .from('invoices')
  .createSignedUrl(`${tenantId}/${invoiceNumber}.pdf`, 3600)
```

---

## 6. Edge Functions & Cron Jobs

### Supabase Edge Functions (Deno runtime)
```
Runtime        : Deno 1.x
Language       : TypeScript
Deploy command : npx supabase functions deploy FUNCTION_NAME
Local dev      : npx supabase functions serve
Secrets        : npx supabase secrets set KEY=VALUE
```

**All 9 Edge Functions to build:**

| Function | Trigger | Purpose |
|---|---|---|
| `whatsapp-webhook` | HTTP (Meta webhook) | Route all incoming WhatsApp messages |
| `whatsapp-flow-endpoint` | HTTP (Meta Flows) | Return dynamic slot data to WhatsApp Flows |
| `send-whatsapp-otp` | HTTP (POST) | Generate + send OTP via WhatsApp |
| `verify-whatsapp-otp` | HTTP (POST) | Verify OTP + create session |
| `appointment-reminders` | pg_cron 8am IST | Send reminder 24h before appointment |
| `follow-up-trigger` | pg_cron 10am IST | Message customers not seen in 30 days |
| `send-invoice` | DB webhook (invoices insert) | Generate PDF + send on WhatsApp |
| `aggregate-analytics` | pg_cron 11:30pm IST | Pre-aggregate daily/monthly analytics |
| `razorpay-webhook` | HTTP (Razorpay) | Handle subscription events |

**Shared utilities (`supabase/functions/_shared/`):**
```
_shared/
  ├── cors.ts          ← CORS headers for all functions
  ├── supabase.ts      ← Admin Supabase client (service role)
  └── whatsapp.ts      ← sendWhatsAppMessage, buildTemplateMessage,
                          buildInteractiveButtonMessage, buildListMessage
```

**`_shared/cors.ts`:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
```

**`_shared/supabase.ts`:**
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Database } from '../../../types/database.types.ts'

export const supabaseAdmin = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
```

### Supabase pg_cron
```
Extension : pg_cron (enable in Supabase Dashboard → Extensions)
Also need : pg_net (for HTTP calls from SQL)
```

**All 4 cron jobs:**
```sql
-- 1. Appointment reminders — 8:00 AM IST = 2:30 AM UTC
select cron.schedule('appointment-reminders', '30 2 * * *', $$
  select net.http_post(
    url    := current_setting('app.edge_base_url') || '/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
$$);

-- 2. 30-day follow-up — 10:00 AM IST = 4:30 AM UTC
select cron.schedule('follow-up-trigger', '30 4 * * *', $$
  select net.http_post(
    url    := current_setting('app.edge_base_url') || '/follow-up-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
$$);

-- 3. Daily analytics — 11:30 PM IST = 6:00 PM UTC
select cron.schedule('daily-analytics', '0 18 * * *', $$
  select net.http_post(
    url    := current_setting('app.edge_base_url') || '/aggregate-analytics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{"period":"daily"}'::jsonb
  )
$$);

-- 4. Monthly analytics — 1st of month 11:30 PM IST
select cron.schedule('monthly-analytics', '0 18 1 * *', $$
  select net.http_post(
    url    := current_setting('app.edge_base_url') || '/aggregate-analytics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{"period":"monthly"}'::jsonb
  )
$$);
```

---

## 7. WhatsApp Integration

### Meta WhatsApp Cloud API
```
API Version   : v18.0
Base URL      : https://graph.facebook.com/v18.0
Auth          : Bearer token (per-branch access token)
Webhook       : POST to your Edge Function URL
Verify token  : Random string stored in env (META_WEBHOOK_VERIFY_TOKEN)
```

**Setup checklist:**
```
1. Create Meta Business Account (business.facebook.com)
2. Create Meta Developer App (developers.facebook.com)
3. Add WhatsApp product to app
4. Get permanent System User access token
   (Business Settings → System Users → Generate Token)
5. Register each branch's phone number with Meta
   (each branch has its own whatsapp_phone_id)
6. Set webhook URL:
   https://your-project.supabase.co/functions/v1/whatsapp-webhook
7. Subscribe webhook to: messages, message_deliveries, message_reads
8. Register and get approved all 6 message templates
```

**Message templates to register:**

```
Template 1: customer_followup
  Category : MARKETING
  Language : en
  Body     : "Hi {{1}}! 👋\n\nWe miss you at {{2}}! ✨\n\nIt's been a while
              since your last visit. Your hair deserves some love! 💕\n\n
              Reply *Book* to schedule your next appointment — or tap below! 👇"
  Buttons  : [Quick Reply: "📅 Book Appointment"]
             [Quick Reply: "💰 View Our Services"]
  Params   : {{1}} = customer_name, {{2}} = salon_name

Template 2: booking_confirmation
  Category : UTILITY
  Language : en
  Body     : "Hi {{1}}, your appointment is confirmed! ✅\n\n
              ✂️ *{{2}}*\n📅 {{3}}\n⏰ {{4}}\n👤 Stylist: {{5}}\n📍 {{6}}
              \n\nSee you soon! 💇"
  Buttons  : [Quick Reply: "Reschedule"]
             [Quick Reply: "Cancel"]
  Params   : customer_name, service_name, date, time, stylist_name, branch_name

Template 3: appointment_reminder
  Category : UTILITY
  Language : en
  Body     : "Hi {{1}}, just a reminder! 📅\n\nYou have an appointment
              *tomorrow*:\n✂️ {{2}} at {{3}}\n👤 {{4}}\n📍 {{5}}
              \n\nNeed to change plans?"
  Buttons  : [Quick Reply: "Confirm ✅"]
             [Quick Reply: "Reschedule"]
             [Quick Reply: "Cancel"]
  Params   : customer_name, service_name, time, stylist_name, branch_name

Template 4: invoice_message
  Category  : UTILITY
  Language  : en
  Header    : Document (PDF)
  Body      : "Hi {{1}}, thank you for visiting {{2}}! 🙏\n\n
               Your invoice *#{{3}}* for *₹{{4}}* is attached.\n\n{{5}}
               \n\nHope to see you again soon! 💖"
  Buttons   : [Quick Reply: "📥 Download PDF Receipt"]
              [Quick Reply: "📅 Book Next Appointment"]
  Params    : customer_name, branch_name, invoice_number, total, items_summary

Template 5: otp_message
  Category  : AUTHENTICATION
  Language  : en
  Body      : "Your OTP to login to {{1}} is *{{2}}*.\n\n
               Valid for 5 minutes. Do not share this with anyone."
  Params    : salon_name, otp_code

Template 6: membership_welcome
  Category  : UTILITY
  Language  : en
  Body      : "🏅 Congratulations {{1}}!\n\nYou are now a *{{2}}* member
               at {{3}}.\n\n✨ Enjoy {{4}}% discount on all services.
               \nValid till: {{5}}\n\nThank you for your loyalty! 💖"
  Params    : customer_name, plan_name, salon_name, discount_pct, expiry_date
```

**`lib/whatsapp/sender.ts` — Core API wrapper:**
```typescript
const WA_BASE = 'https://graph.facebook.com/v18.0'

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${WA_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error?.message }
    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function templateMessage(
  name: string,
  params: string[],
  buttons?: string[]
) {
  return {
    type: 'template',
    template: {
      name,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: params.map(text => ({ type: 'text', text })),
        },
        ...(buttons || []).map((payload, index) => ({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(index),
          parameters: [{ type: 'payload', payload }],
        })),
      ],
    },
  }
}

export function interactiveButtons(
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  }
}

export function interactiveList(
  body: string,
  buttonLabel: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
) {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonLabel, sections },
    },
  }
}

export function documentMessage(
  link: string,
  filename: string,
  caption?: string
) {
  return {
    type: 'document',
    document: { link, filename, ...(caption ? { caption } : {}) },
  }
}
```

### WhatsApp Flows
```
Builder   : Meta Flow Builder (developers.facebook.com/docs/whatsapp/flows)
Flow name : salon_booking_flow
Screens   : SELECT_SERVICE → SELECT_STYLIST → SELECT_DATE → SELECT_TIME → COMPLETE
Data feed : Dynamic — slots fetched from whatsapp-flow-endpoint Edge Function
Trigger   : Sent as interactive message with flow CTA button
```

---

## 8. PDF Generation

### @react-pdf/renderer
```
Version  : latest
Use case : Invoice PDF generation (server-side in Edge Functions)
Storage  : Generated PDF → Supabase Storage → signed URL → WhatsApp
```

**Install:**
```bash
npm install @react-pdf/renderer
```

**Usage in Edge Function (server-side render):**
```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '../../../components/billing/InvoicePDFTemplate.tsx'

const pdfBuffer = await renderToBuffer(
  <InvoicePDF invoice={invoice} branch={branch} customer={customer} items={items} />
)
```

**PDF must contain:**
```
Header : Salon name, branch address, WhatsApp number, Invoice number, Date, Payment method
Bill To: Customer name, phone
Table  : Service name | Qty | Unit Price | Total (per row)
Totals : Subtotal, Discount (if any, show %, highlight green), GST (if enabled), TOTAL (bold)
Footer : "Thank you! Book again: WhatsApp {number}"
```

---

## 9. Charts & Analytics

### Recharts
```
Version  : latest
Use case : Revenue, appointments, service analytics, retention
All charts must be wrapped in <ResponsiveContainer width="100%" height={300}>
```

**Install:**
```bash
npm install recharts
```

**6 Charts to build:**

| Chart | Type | Data source |
|---|---|---|
| Revenue over time | LineChart | analytics_snapshots |
| Appointment status | PieChart (donut) | analytics_snapshots |
| Top services by revenue | BarChart (horizontal) | invoice_items GROUP BY |
| Top services by count | BarChart (horizontal) | appointments GROUP BY |
| New vs returning customers | BarChart (stacked) | analytics_snapshots |
| Revenue by branch (owner) | BarChart (grouped) | analytics_snapshots |

**Chart conventions:**
```typescript
// Always format Y-axis as INR
const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR',
    notation: 'compact', maximumFractionDigits: 1 }).format(value)

// Always use these brand colors for chart series
const CHART_COLORS = {
  primary:   '#d946ef',   // brand purple
  secondary: '#25d366',   // WhatsApp green
  tertiary:  '#f59e0b',   // amber
  danger:    '#ef4444',   // red
  muted:     '#94a3b8',   // slate
}

// Custom tooltip always shows ₹ and IST date
```

---

## 10. State Management

### Zustand (global UI state)
```
Use for  : Selected branch, sidebar open/close, any global UI state
Version  : latest
```

**Install:**
```bash
npm install zustand
```

**`stores/branchStore.ts`:**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BranchStore {
  selectedBranchId: string | null
  setSelectedBranch: (id: string | null) => void
}

export const useBranchStore = create<BranchStore>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranch: (id) => set({ selectedBranchId: id }),
    }),
    { name: 'selected-branch' }
  )
)
```

### TanStack Query (server state)
```
Use for  : All Supabase data fetching, caching, background refetch
Version  : @tanstack/react-query v5
```

**Install:**
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**`app/providers.tsx`:**
```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,       // 1 min
        refetchOnWindowFocus: false,
      },
    },
  }))
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

---

## 11. Forms & Validation

### React Hook Form + Zod
```
Use for  : All forms (booking, billing, customer, staff, settings)
Version  : react-hook-form latest, zod latest
```

**Install:**
```bash
npm install react-hook-form @hookform/resolvers zod
```

**Pattern (use for every form):**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const customerSchema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string()
    .regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit Indian mobile number'),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
})

type CustomerForm = z.infer<typeof customerSchema>

const form = useForm<CustomerForm>({
  resolver: zodResolver(customerSchema),
  defaultValues: { name: '', phone: '', email: '' },
})
```

---

## 12. Date & Time

### date-fns + date-fns-tz
```
Timezone : ALWAYS Asia/Kolkata (IST, UTC+5:30)
Format   : DD MMM YYYY for dates, hh:mm a for times (12-hour)
Storage  : Always store as UTC in database, display as IST
```

**Install:**
```bash
npm install date-fns date-fns-tz
```

**`lib/utils/date.ts`:**
```typescript
import { format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const IST = 'Asia/Kolkata'

// "10 May 2026"
export const formatDate = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'dd MMM yyyy')

// "10 May 2026, 02:30 PM"
export const formatDateTime = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'dd MMM yyyy, hh:mm a')

// "02:30 PM"
export const formatTime = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'hh:mm a')

// Convert IST input to UTC for DB storage
export const toUTC = (d: Date) => fromZonedTime(d, IST)
```

---

## 13. Currency & Phone Formatting

**`lib/utils/currency.ts`:**
```typescript
// ₹1,00,000 — Indian number format
export const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

// ₹1.2L — compact for charts
export const formatINRCompact = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
```

**`lib/utils/phone.ts`:**
```typescript
// Store: +919876543210 — Display: +91 98765 43210
export const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    const num = digits.slice(2)
    return `+91 ${num.slice(0,5)} ${num.slice(5)}`
  }
  return phone
}

// Normalize to +91XXXXXXXXXX for storage
export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return phone
}
```

---

## 14. SaaS Payments

### Razorpay
```
Use case : Monthly subscription billing for salon owners
Mode     : Subscriptions API
Currency : INR only
```

**Install:**
```bash
npm install razorpay
```

**Plans (create in Razorpay dashboard):**
```
starter_monthly  : ₹499/mo  — 1 branch, 3 staff, core features
pro_monthly      : ₹999/mo  — unlimited branches + staff + analytics
enterprise_monthly: ₹1999/mo — custom + white-label
```

**`lib/razorpay/client.ts`:**
```typescript
import Razorpay from 'razorpay'

export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})
```

**Webhook events to handle (`app/api/webhooks/razorpay/route.ts`):**
```
subscription.activated  → update tenants.plan = selected plan, is_active = true
subscription.charged    → log payment in audit_logs
subscription.cancelled  → schedule is_active = false at period end
payment.failed          → send WhatsApp alert to owner's phone
```

---

## 15. Icons

### Lucide React
```
Version : lucide-react (bundled with shadcn/ui)
Usage   : import { IconName } from 'lucide-react'
```

**Key icons used:**
```typescript
import {
  // Navigation
  LayoutDashboard, Calendar, Users, Scissors, Receipt,
  Crown, UserCog, Building2, BarChart3, ClipboardList, Settings,
  // Actions
  Plus, Edit, Trash2, Search, Filter, Download, Send,
  CheckCircle, XCircle, Clock, AlertCircle,
  // WhatsApp/Comm
  MessageCircle, Phone, Bell, BellOff,
  // Business
  TrendingUp, TrendingDown, IndianRupee, Package,
  // UI
  ChevronDown, ChevronRight, Menu, X, Loader2, RefreshCw,
  Eye, EyeOff, Copy, ExternalLink, Upload, FileText,
} from 'lucide-react'
```

---

## 16. Hosting

### Vercel
```
Plan     : Hobby (free) → Pro ($20/mo) when needed
Framework: Next.js (auto-detected)
Region   : Mumbai (sin1 or bom1 — check Vercel dashboard for latest India region)
```

**`vercel.json`:**
```json
{
  "framework": "nextjs",
  "regions": ["bom1"],
  "env": {
    "NEXT_PUBLIC_APP_URL": "@app_url"
  }
}
```

**Vercel env vars to add (all from `.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
META_ACCESS_TOKEN
META_WEBHOOK_VERIFY_TOKEN
META_APP_SECRET
NEXT_PUBLIC_META_APP_ID
NEXT_PUBLIC_META_CONFIG_ID
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_NAME
CRON_SECRET
```

---

## 17. Package Manager & Scripts

```bash
# Use npm (default with create-next-app)
# Do NOT use yarn or pnpm — keep it simple

# Dev
npm run dev

# Build + type check
npm run build

# Type check only
npx tsc --noEmit

# Lint
npm run lint

# Supabase local dev
npx supabase start
npx supabase functions serve

# Deploy Edge Functions
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy follow-up-trigger
# ... etc

# Generate fresh types after schema changes
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID > types/database.types.ts
```

---

## 18. Full `package.json` dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",

    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",

    "@tanstack/react-query": "^5.40.0",
    "zustand": "^4.5.0",

    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.4.0",
    "zod": "^3.23.0",

    "recharts": "^2.12.0",
    "@react-pdf/renderer": "^3.4.0",

    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.0",

    "razorpay": "^2.9.0",

    "lucide-react": "^0.383.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "tailwindcss-animate": "^1.0.7",

    "next-themes": "^0.3.0",
    "sonner": "^1.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@tanstack/react-query-devtools": "^5.40.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@tailwindcss/forms": "^0.5.7",
    "@tailwindcss/typography": "^0.5.13",
    "supabase": "^1.170.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

---

## 19. Complete `.env.local`

```env
# ─── Supabase ─────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ─── Meta WhatsApp Cloud API ───────────────────────────────────────────
META_ACCESS_TOKEN=EAAxxxxx          # permanent system user token
META_WEBHOOK_VERIFY_TOKEN=any_random_secret_string_you_choose
META_APP_SECRET=xxxxx               # from Meta app dashboard
NEXT_PUBLIC_META_APP_ID=12345678
NEXT_PUBLIC_META_CONFIG_ID=12345678 # WhatsApp embedded signup config

# ─── Razorpay ─────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx

# ─── App ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=SnipHQ
CRON_SECRET=any_random_secret_to_protect_cron_routes
```

---

## 20. TypeScript Config

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "supabase/functions"]
}
```

---

## 21. India-Specific Rules (Apply Everywhere, No Exceptions)

```
✅ Phone numbers  : Store as +91XXXXXXXXXX, display as +91 XXXXX XXXXX
✅ Currency       : Always INR ₹, Indian number format (1,00,000 not 100,000)
✅ Timezone       : Store UTC, ALWAYS display in IST (Asia/Kolkata)
✅ Date format    : DD MMM YYYY (10 May 2026)
✅ Time format    : 12-hour hh:mm a (02:30 PM)
✅ Payment modes  : Cash, UPI (equal first-class), Card, Other
✅ GST            : Optional on invoices, configurable 0/5/12/18%
✅ Language       : English UI, Indian English copy ("Rs." acceptable)
✅ WhatsApp       : Primary channel — email is always secondary/optional
```

---

## 22. Security Rules (Non-Negotiable)

```
✅ Service role key NEVER in client-side code or NEXT_PUBLIC_ vars
✅ All dashboard routes protected by middleware auth check
✅ All DB queries must include tenant_id filter (RLS is backup, not primary)
✅ All Edge Functions validate Authorization header before processing
✅ Meta webhook signature verified using APP_SECRET on every request
✅ Razorpay webhook signature verified using WEBHOOK_SECRET
✅ OTP expires after 5 minutes, single-use only
✅ Audit log written on every create/update/delete
✅ No raw SQL string concatenation — always use parameterized queries
```

---

## 23. Tech Stack Summary Table

| Layer | Technology | Version | Cost |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.x | Free |
| Language | TypeScript strict | 5.x | Free |
| Styling | Tailwind CSS | 3.x | Free |
| Components | shadcn/ui | Latest | Free |
| Database | Supabase PostgreSQL | 15 | Free → $25/mo |
| Auth | Supabase Auth | — | Free |
| Storage | Supabase Storage | — | Free → $0.021/GB |
| Edge Functions | Supabase Edge (Deno) | — | Free → $2/M calls |
| Cron Jobs | Supabase pg_cron | — | Free |
| WhatsApp | Meta Cloud API | v18.0 | Free (1K conv/mo) |
| WhatsApp Flows | Meta Flows Builder | — | Free |
| PDF | @react-pdf/renderer | 3.x | Free |
| Charts | Recharts | 2.x | Free |
| Global State | Zustand | 4.x | Free |
| Server State | TanStack Query | 5.x | Free |
| Forms | React Hook Form + Zod | Latest | Free |
| Date/Time | date-fns + date-fns-tz | 3.x | Free |
| Icons | Lucide React | 0.383 | Free |
| Payments | Razorpay | 2.x | 2% per txn |
| Hosting | Vercel | — | Free → $20/mo |
| **TOTAL** | | | **₹0/mo to start** |
```
