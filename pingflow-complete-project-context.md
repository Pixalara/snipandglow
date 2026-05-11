# PingFlow — Complete Project Context Document
# Version: 1.0 | Date: April 2026
# Use this as master context in Google AI Studio (Antigravity)

---

## 1. PRODUCT OVERVIEW

### What is PingFlow?
PingFlow is a WhatsApp-based revenue automation CRM built 
exclusively for gym owners in India. It is NOT a generic CRM — 
it is a revenue recovery system that automates member lifecycle 
management over WhatsApp.

### Core Promise
"Turn this on and automatically recover lost members."

### Target Users
Small and medium gym owners in India who currently manage 
operations manually using notebooks, Excel, or basic tools.

### Problem Solved
Gym owners lose revenue because:
- Members forget to renew memberships
- Follow-ups are inconsistent or manual
- No system detects upcoming expiries automatically

### Solution
Automates WhatsApp messages at key moments:
- D-3: Renewal reminder (3 days before expiry)
- D-0: Expiry alert (on expiry day)
- D+2: Follow-up (2 days after expiry)
- On payment: Invoice sent via WhatsApp

### Business Model
Subscription SaaS — gym owners pay per month:
- Starter: ₹999/month (up to 200 members)
- Pro: ₹2,499/month (unlimited members)

### Live URLs
- Production App: https://pingflow.pixalara.io
- Firebase Console: https://console.firebase.google.com/project/pingflow-da311
- AiSensy Dashboard: https://app.aisensy.com

---

## 2. COMPLETE TECH STACK

### Frontend
```
Framework:      React 18 + TypeScript + Vite
Styling:        Tailwind CSS (layout only) + Inline styles (visual)
State Mgmt:     Zustand
Forms:          React Hook Form + Zod validation
Date Handling:  date-fns
Routing:        React Router v6
Fonts:          Syne (headings) + DM Sans (body) + JetBrains Mono
Hosting:        Firebase Hosting → pingflow.pixalara.io
Build Output:   frontend/dist/
```

### Backend
```
Database:       Firebase Firestore (NoSQL)
Auth:           Firebase Authentication (Google OAuth)
Functions:      Firebase Cloud Functions v2 (Node.js/TypeScript)
Scheduler:      Google Cloud Scheduler
Region:         asia-south1 (Mumbai — lowest latency for India)
Plan:           Blaze (pay-as-you-go)
```

### WhatsApp Integration
```
Provider:       AiSensy (Free Forever plan)
API Number:     +919449602995 (Meta verified ✅)
API Type:       Campaign API (free tier)
Project ID:     69ccf6e3463fa10ded05baa8
API Endpoint:   https://backend.aisensy.com/campaign/t1/api/v2
WCC Balance:    ₹50 (needs recharge to ₹500)
Quality Rating: High ✅
```

### Firebase Configuration
```
Project ID:     pingflow-da311
Auth Domain:    pingflow-da311.firebaseapp.com
Storage Bucket: pingflow-da311.firebasestorage.app
Sender ID:      1005842073585
App ID:         1:1005842073585:web:c5f51790837c1b0f226650
```

---

## 3. DESIGN SYSTEM

### Color Palette (use everywhere)
```css
--bg:              #080C14   /* Page background */
--surface:         #0F1724   /* Panel background */
--card:            #111827   /* Card background */
--card-hover:      #151F2E   /* Card hover state */
--border:          #1E2D45   /* All borders */
--border-light:    #243044   /* Hover borders */
--primary:         #00D084   /* Green — main CTA */
--primary-dim:     rgba(0,208,132,0.12)
--primary-glow:    rgba(0,208,132,0.25)
--accent:          #3B82F6   /* Blue — secondary */
--accent-dim:      rgba(59,130,246,0.12)
--warning:         #F59E0B   /* Amber — expiring */
--warning-dim:     rgba(245,158,11,0.12)
--danger:          #EF4444   /* Red — expired */
--danger-dim:      rgba(239,68,68,0.12)
--text:            #F0F6FF   /* Primary text */
--text-muted:      #64748B   /* Secondary text */
--text-dim:        #334155   /* Disabled text */
```

### Typography
```
Headings:   'Syne', sans-serif (Google Fonts)
Body:       'DM Sans', sans-serif (Google Fonts)
Monospace:  'JetBrains Mono' (stats, invoice numbers)

H1 page title:    26-28px, Syne 700, #F0F6FF
H2 section:       20-22px, Syne 700, #F0F6FF
H3 card title:    16-18px, Syne 600, #F0F6FF
Body text:        14px, DM Sans 400, #94A3B8
Label/Caption:    11-12px, DM Sans 600, uppercase, #64748B
```

### Component Styles (always use these)
```
Cards:
  backgroundColor: #111827
  border: 1px solid #1E2D45
  borderRadius: 14px
  padding: 20px 24px

Inputs:
  backgroundColor: #080C14
  border: 1px solid #1E2D45
  borderRadius: 10px
  height: 46px
  padding: 0 14px
  fontSize: 14px, color: #F0F6FF
  focus: border #00D084, shadow 0 0 0 3px rgba(0,208,132,0.1)

Primary Button:
  backgroundColor: #00D084
  color: #080C14
  borderRadius: 10px
  padding: 10px 24px
  fontWeight: 700
  boxShadow: 0 4px 16px rgba(0,208,132,0.3)

Ghost Button:
  backgroundColor: transparent
  border: 1px solid #1E2D45
  color: #64748B
  borderRadius: 10px
  padding: 10px 20px

Danger Button:
  backgroundColor: rgba(239,68,68,0.1)
  border: 1px solid rgba(239,68,68,0.3)
  color: #EF4444
  borderRadius: 10px

Modal Overlay:
  position: fixed
  top/left/right/bottom: 0
  width: 100vw, height: 100vh
  backgroundColor: rgba(4,8,20,0.88)
  backdropFilter: blur(12px)
  display: flex, alignItems: center, justifyContent: center
  zIndex: 9999

Modal Card:
  backgroundColor: #0F1724
  border: 1px solid #1E2D45
  borderRadius: 18px
  maxWidth: 480px, width: 100%
  maxHeight: 90vh, overflowY: auto
  boxShadow: 0 24px 80px rgba(0,0,0,0.7)
  animation: modalIn 220ms cubic-bezier(0.34,1.56,0.64,1)
```

### Status Badge Config
```typescript
const statusConfig = {
  active:        { bg:'rgba(0,208,132,0.12)',  color:'#00D084', label:'Active' },
  expiring_soon: { bg:'rgba(245,158,11,0.12)', color:'#F59E0B', label:'Expiring' },
  expired:       { bg:'rgba(239,68,68,0.12)',  color:'#EF4444', label:'Expired' },
  inactive:      { bg:'rgba(100,116,139,0.12)',color:'#64748B', label:'Inactive' },
  // Payment statuses:
  paid:          { bg:'rgba(0,208,132,0.12)',  color:'#00D084', label:'PAID' },
  partial:       { bg:'rgba(59,130,246,0.12)', color:'#3B82F6', label:'PARTIAL' },
  pending:       { bg:'rgba(245,158,11,0.12)', color:'#F59E0B', label:'PENDING' },
  overdue:       { bg:'rgba(239,68,68,0.12)',  color:'#EF4444', label:'OVERDUE' },
}
```

### CODING RULE (Critical)
Use inline styles ONLY for all visual properties.
Never use Tailwind for: colors, spacing, typography, borders.
Tailwind allowed ONLY for: flex, grid, hidden, overflow utilities.
This rule exists because Tailwind was overriding inline values.

---

## 4. FIRESTORE SCHEMA (Complete)

### Collection: gyms/{gymId}
```typescript
{
  ownerName: string;
  gymName: string;
  email: string;
  phone: string;
  photoURL: string;
  plan: 'trial' | 'trial_starter' | 'trial_pro';
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  isActive: boolean;
  onboardingComplete: boolean;
  createdAt: Timestamp;

  // AiSensy WhatsApp config
  watiApiKey: string;            // AiSensy Campaign API Key
  watiApiEndpoint: string;       // https://backend.aisensy.com

  // Billing settings
  billingSettings: {
    gymName: string;
    gymAddress: string;
    gymPhone: string;
    gstin?: string;              // GST number (optional)
    hsnCode: string;             // Default: 999311 (fitness services)
    gstRate: number;             // Default: 18
    invoicePrefix: string;       // Default: PF
    invoiceCounter: number;      // Auto-increments
    sendInvoiceOnWhatsApp: boolean;
  };
}
```

### Collection: gyms/{gymId}/members/{memberId}
```typescript
{
  name: string;
  phone: string;                 // E.164: +91XXXXXXXXXX
  planId: string;
  planName: string;              // Duplicated for fast reads
  startDate: Timestamp;
  endDate: Timestamp;
  endDateUnix: number;           // Unix seconds — for range queries
  status: 'active' | 'expiring_soon' | 'expired' | 'inactive';
  lastVisitDate: Timestamp | null; // Optional — most gyms don't track
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: gyms/{gymId}/plans/{planId}
```typescript
{
  name: string;                  // e.g., Monthly, Quarterly, Annual
  durationDays: number;          // 30, 90, 365
  price: number;                 // INR — no paise
  isActive: boolean;
  createdAt: Timestamp;
}
```

### Collection: gyms/{gymId}/payments/{paymentId}
```typescript
{
  memberId: string;
  memberName: string;
  memberPhone: string;
  planId: string;
  planName: string;
  planDurationDays: number;
  invoiceNumber: string;         // Format: PF-2025-0001
  invoiceDate: Timestamp;
  dueDate: Timestamp;
  subtotal: number;              // Base amount before GST
  gstRate: number;               // 18
  gstAmount: number;             // subtotal * 0.18
  totalAmount: number;           // subtotal + gstAmount
  paidAmount: number;
  balanceDue: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other';
  upiTransactionId?: string;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  membershipStartDate: Timestamp;
  membershipEndDate: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: gyms/{gymId}/automationLogs/{logId}
```typescript
{
  memberId: string;
  memberName: string;
  memberPhone: string;
  eventType: 'expiry_reminder_d3' 
           | 'expiry_alert_d0' 
           | 'expiry_followup_d2';
  messageStatus: 'sent' | 'failed' | 'skipped';
  templateName: string;
  errorMessage?: string;
  timestamp: Timestamp;
}
```

### Collection: gyms/{gymId}/campaigns/{campaignId}
```typescript
{
  name: string;
  templateName: string;
  targetGroup: 'all' | 'active' | 'expired' | 'expiring_soon';
  status: 'draft' | 'running' | 'completed' | 'failed';
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  scheduledAt: Timestamp | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
}
```

### Firestore Indexes (firestore.indexes.json)
```json
{
  "indexes": [
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "endDateUnix", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "endDateUnix", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "automationLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventType", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "automationLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "memberId", "order": "ASCENDING" },
        { "fieldPath": "eventType", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "invoiceDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gyms/{gymId}/{document=**} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == gymId;
    }
  }
}
```

---

## 5. FILE STRUCTURE (Complete)

```
whatsapp-gym-crm/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Modal.tsx          ✅ Built
│   │   │   │   └── ModalButtons.tsx   ✅ Built
│   │   │   └── layout/
│   │   │       └── Sidebar.tsx        ✅ Built
│   │   ├── pages/
│   │   │   ├── Login.tsx              ✅ Built
│   │   │   ├── Onboarding.tsx         ✅ Built
│   │   │   ├── Dashboard.tsx          ✅ Built
│   │   │   ├── Members.tsx            ✅ Built
│   │   │   ├── MemberDetail.tsx       ✅ Built
│   │   │   ├── Plans.tsx              ✅ Built
│   │   │   ├── AutomationLogs.tsx     ✅ Built ⏳ Not deployed
│   │   │   ├── Billing.tsx            ❌ Phase 4
│   │   │   ├── Campaigns.tsx          ❌ Phase 5
│   │   │   └── Settings.tsx           ✅ Built ⏳ Not deployed
│   │   ├── services/
│   │   │   ├── firebase.ts            ✅ Built
│   │   │   ├── members.service.ts     ✅ Built
│   │   │   ├── plans.service.ts       ✅ Built
│   │   │   ├── whatsapp.service.ts    ✅ Built ⏳ Not deployed
│   │   │   └── billing.service.ts     ❌ Phase 4
│   │   ├── store/
│   │   │   └── authStore.ts           ✅ Built
│   │   ├── types/
│   │   │   └── index.ts               ✅ Built
│   │   └── utils/
│   │       ├── billing.utils.ts       ❌ Phase 4
│   │       └── invoicePDF.ts          ❌ Phase 4
│   ├── .env.local                     ✅ Configured
│   ├── index.html                     ✅ Built
│   └── vite.config.ts                 ✅ Built
│
├── functions/
│   ├── src/
│   │   ├── index.ts                   ✅ Built ⏳ Not deployed
│   │   ├── automation/
│   │   │   └── expiryChecker.ts       ✅ Built ⏳ Not deployed
│   │   └── whatsapp/
│   │       ├── aisensy.service.ts     ✅ Built ⏳ Not deployed
│   │       └── templates.ts           ✅ Built ⏳ Not deployed
│   ├── .env                           ⚠️ Needs API key
│   ├── package.json                   ✅ Built
│   └── tsconfig.json                  ✅ Built
│
├── firestore.rules                    ✅ Deployed
├── firestore.indexes.json             ✅ Updated ⏳ Not deployed
└── firebase.json                      ✅ Built
```

---

## 6. ENVIRONMENT VARIABLES

### frontend/.env.local
```
VITE_FIREBASE_API_KEY=AIzaSyA5FT8jjfb77cWgaoBwNDiULWqhUfxv4Ug
VITE_FIREBASE_AUTH_DOMAIN=pingflow-da311.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pingflow-da311
VITE_FIREBASE_STORAGE_BUCKET=pingflow-da311.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1005842073585
VITE_FIREBASE_APP_ID=1:1005842073585:web:c5f51790837c1b0f226650
```

### functions/.env
```
AISENSY_API_KEY=        ← paste Campaign API key here
AISENSY_PHONE=919449602995
AISENSY_PROJECT_ID=69ccf6e3463fa10ded05baa8
```

---

## 7. AISENSY API INTEGRATION

### API Details
```
Provider:      AiSensy
Plan:          Free Forever
Number:        +919449602995 (Meta verified)
Project ID:    69ccf6e3463fa10ded05baa8
API Endpoint:  https://backend.aisensy.com/campaign/t1/api/v2
Auth:          Bearer token (Campaign API Key)
```

### Send Template Message — API Call
```typescript
POST https://backend.aisensy.com/campaign/t1/api/v2
Headers:
  Content-Type: application/json

Body:
{
  "apiKey": "YOUR_CAMPAIGN_API_KEY",
  "campaignName": "pingflow_expiry_d3",
  "destination": "919449602995",  // NO + prefix
  "userName": "Pixalara",
  "templateParams": ["Rahul", "PowerHouse Gym", "07 Apr 2026"],
  "source": "pingflow-automation",
  "media": {},
  "buttons": [],
  "carouselCards": [],
  "location": {},
  "paramsFallbackValue": { "FirstName": "Member" }
}
```

### Phone Format Rule
```
Firestore stores:  +919449602995  (E.164 with +)
AiSensy needs:      919449602995  (strip the +)
```

---

## 8. WHATSAPP TEMPLATES

### Templates to Create in AiSensy → Manage → Templates

#### Template 1: gym_expiry_reminder
```
Category:  Utility
Name:      gym_expiry_reminder
Language:  English

Header:    (none)
Body:
Hi {{1}} 👋

Your membership at *{{2}}* expires in *3 days* on {{3}}.

Renew now to keep your fitness streak going! 💪
Contact your gym to renew today.

Footer:    PingFlow — Gym Automation
Buttons:   (none)

Parameters:
  {{1}} = Member Name
  {{2}} = Gym Name
  {{3}} = Expiry Date (e.g., 07 Apr 2026)
```

#### Template 2: gym_expiry_alert
```
Category:  Utility
Name:      gym_expiry_alert
Language:  English

Body:
Hi {{1}} 👋

Your membership at *{{2}}* has *expired today*.

Don't let your fitness journey stop! Contact your 
gym immediately to renew your membership. 🏋️

Footer:    PingFlow — Gym Automation

Parameters:
  {{1}} = Member Name
  {{2}} = Gym Name
```

#### Template 3: gym_expiry_followup
```
Category:  Marketing
Name:      gym_expiry_followup
Language:  English

Body:
Hi {{1}} 👋

We miss you at *{{2}}*! 

Your membership expired 2 days ago. We have a 
special offer waiting for you — reply to this 
message to know more! 🎁

Footer:    PingFlow — Gym Automation

Parameters:
  {{1}} = Member Name
  {{2}} = Gym Name
```

#### Template 4: gym_payment_receipt
```
Category:  Utility
Name:      gym_payment_receipt
Language:  English

Body:
Hi {{1}} 👋

Your payment receipt for *{{2}}*

🧾 Invoice: {{3}}
💰 Amount Paid: ₹{{4}}
📋 Plan: {{5}}
📅 Period: {{6}}

Thank you for your payment! Your membership 
is now active. 💪

For any queries, reply to this message.

Footer:    PingFlow — Gym Automation

Parameters:
  {{1}} = Member Name
  {{2}} = Gym Name
  {{3}} = Invoice Number (e.g., PF-2025-0001)
  {{4}} = Total Amount (e.g., 1180)
  {{5}} = Plan Name (e.g., Monthly)
  {{6}} = Period (e.g., 01 Apr 2025 – 30 Apr 2025)
```

---

## 9. AUTOMATION LOGIC

### Expiry Flow — Cloud Scheduler
```
Trigger:    Daily at 9:00 AM IST
Cron:       30 3 * * *  (UTC)
Timezone:   Asia/Kolkata
Region:     asia-south1
Memory:     256MiB
Timeout:    300 seconds

Logic:
1. Fetch all gyms WHERE isActive == true
2. For each gym:
   a. Check watiApiKey exists → skip if missing
   b. Get today in IST timezone
   c. Query members WHERE:
      endDateUnix >= (today - 2 days) unix
      AND endDateUnix <= (today + 3 days) unix
   d. For each member:
      daysUntilExpiry = differenceInDays(endDate, today)
      
      daysUntilExpiry === 3  → gym_expiry_reminder
      daysUntilExpiry === 0  → gym_expiry_alert
      daysUntilExpiry === -2 → gym_expiry_followup
      else → skip
      
   e. Dedup check:
      Query automationLogs WHERE:
        memberId == member.id
        AND eventType == currentEventType
        AND timestamp >= today 00:00 IST
      If exists → skip
      
   f. Send via AiSensy API
   g. Write to automationLogs
   h. Update member.status
   
3. Return summary stats

IMPORTANT: Inactivity flow REMOVED.
Reason: Indian gyms don't track attendance.
lastVisitDate is optional field only.
```

---

## 10. PHASE STATUS (Detailed)

### ✅ Phase 1 — Foundation (COMPLETE + DEPLOYED)
```
[x] Firebase project pingflow-da311 created
[x] Vite + React 18 + TypeScript setup
[x] Tailwind CSS v4 configured
[x] Path aliases (@/) configured
[x] TypeScript strict mode
[x] Firebase SDK initialized (firebase.ts)
[x] Firebase Auth — Google OAuth
[x] Phone OTP flow (built but using Google OAuth)
[x] Firestore collections created
[x] Security rules deployed
[x] Composite indexes deployed
[x] Login page — Google sign-in
[x] Onboarding page — split panel layout
    Left: value props + social proof
    Right: gym setup form
[x] Auth-gated routing (Login → Onboarding → Dashboard)
[x] Zustand auth store
[x] All TypeScript interfaces in types/index.ts
[x] Deployed to pingflow.pixalara.io
```

### ✅ Phase 2 — Core CRUD (COMPLETE + DEPLOYED)
```
[x] Dashboard page
    - Welcome header with gym name
    - 4 stat cards (Total/Active/Expiring/Expired)
    - Live Firestore onSnapshot listeners
    - "Expiring in 7 Days" table
    - "Recent Automations" panel
    - "Get Started" checklist cards
    
[x] Members page
    - Searchable table (name, phone, plan)
    - Filter tabs (All/Active/Expiring/Expired/Inactive)
    - Add Member modal (React Hook Form + Zod)
    - Edit Member modal
    - Delete confirmation
    - Status badges with colored dots
    - Phone in E.164 format
    - Auto-calculate status on write
    - endDateUnix stored alongside endDate
    
[x] Plans page
    - Card grid layout
    - Add Plan modal
    - Edit Plan modal
    - Delete with confirmation
    - Price shown in ₹
    
[x] Member Detail page
    - Full member info
    - Edit/Delete actions
    
[x] Sidebar
    - PingFlow logo + ping dot animation
    - Nav: Dashboard/Members/Plans/Automations/Campaigns/Settings
    - Phase badges on Automations and Campaigns
    - User profile (avatar + name + email)
    - Logout button
    - Active state highlighting
    
[x] Layout wrapper (260px fixed sidebar)

[x] Shared components:
    - Modal.tsx (always centered, ESC close, body scroll lock)
    - PrimaryButton (green, loading state)
    - GhostButton (transparent)
    - DangerButton (red)
    - StatusBadge (color-coded)

[x] Dark scrollbar styling
[x] Animations (fadeUp, modalIn, ping)
[x] Deployed to pingflow.pixalara.io
```

### ✅ Phase 3 — Automation Engine (BUILT, NOT DEPLOYED)
```
[x] functions/src/whatsapp/aisensy.service.ts
    - sendTemplateMessage()
    - validatePhone() — strips + for AiSensy
    - isConfigured() — checks watiApiKey exists
    - 10s timeout, 1 retry on 5xx
    - Never throws — always returns AiSensyResponse
    
[x] functions/src/whatsapp/templates.ts
    - TEMPLATES constants
    - EVENT_TYPES constants
    - getTemplateParams() helper
    
[x] functions/src/automation/expiryChecker.ts
    - Full gym loop
    - IST timezone handling
    - D-3, D-0, D+2 logic
    - Dedup check via automationLogs
    - AiSensy send
    - Log write
    - Member status update
    - Summary return
    
[x] functions/src/index.ts
    - dailyExpiryCheck (onSchedule 9AM IST)
    - triggerAutomationManual (onCall for UI testing)
    
[x] frontend/src/services/whatsapp.service.ts
    - triggerManualAutomation(gymId)
    
[x] frontend/src/pages/AutomationLogs.tsx
    - Real-time table with onSnapshot
    - Filter by eventType
    - Filter by status
    - Hover for error details
    - Manual trigger button
    - Loading + result toast
    - Empty state
    
[x] frontend/src/pages/Settings.tsx
    - AiSensy API key field (show/hide toggle)
    - WhatsApp number field
    - Test Connection button
    - Save to Firestore
    - Connection status indicator
    
[x] firestore.indexes.json updated

⏳ PENDING DEPLOYMENT:
  Run: cd functions && npm run build
  Run: firebase deploy --only functions
  Run: firebase deploy --only firestore:indexes
  Run: cd ../frontend && npm run build
  Run: firebase deploy --only hosting
```

### ❌ Phase 4 — Billing & Invoicing (NOT STARTED)
```
Files to build:
  [ ] frontend/src/utils/billing.utils.ts
  [ ] frontend/src/utils/invoicePDF.ts
  [ ] frontend/src/services/billing.service.ts
  [ ] frontend/src/pages/Billing.tsx
  [ ] frontend/src/pages/MemberDetail.tsx (add payment history)
  [ ] frontend/src/pages/Dashboard.tsx (add revenue stats)
  [ ] frontend/src/pages/Settings.tsx (add billing settings)
  [ ] frontend/src/App.tsx (add /billing route)
  [ ] Sidebar (add Billing nav item)

Features:
  [ ] Record payment (cash/UPI/card/bank)
  [ ] Auto-generate invoice number (PF-2025-0001)
  [ ] GST calculation (18%, HSN 999311)
  [ ] Invoice PDF via browser print() — no library
  [ ] WhatsApp invoice via AiSensy (gym_payment_receipt)
  [ ] Payment history per member
  [ ] Billing dashboard (this month / this year / pending)
  [ ] Overdue detection
  [ ] Billing settings (GSTIN, address, prefix)
```

### ❌ Phase 5 — Broadcast Campaigns (NOT STARTED)
```
Features:
  [ ] Campaign creation form
  [ ] Target group selection (All/Active/Expired/Expiring)
  [ ] Message preview
  [ ] Campaign execution Cloud Function
  [ ] Campaign status tracking
  [ ] Campaign history table
```

### ❌ Phase 6 — Settings & Polish (NOT STARTED)
```
Features:
  [ ] Gym profile edit
  [ ] Onboarding checklist completion
  [ ] Empty states with CTAs
  [ ] Error boundaries
  [ ] Toast notification system
  [ ] Mobile responsive fixes
```

---

## 11. IMMEDIATE ACTION ITEMS

### Must do before Phase 3 testing:
```
1. Deploy Phase 3 code:
   cd functions && npm run build
   firebase deploy --only functions
   firebase deploy --only firestore:indexes
   cd ../frontend && npm run build
   firebase deploy --only hosting

2. Add AiSensy Campaign API Key to functions/.env:
   AISENSY_API_KEY=your_key_here
   Get from: AiSensy → Developer → API Campaign Key tab

3. Recharge AiSensy WCC:
   Current: ₹50 (not enough for testing)
   Recharge: ₹500 minimum
   Where: AiSensy Dashboard → Buy More (right panel)

4. Submit WhatsApp templates in AiSensy:
   Go to: AiSensy → Manage → Templates → New Template
   Submit all 4 templates listed in Section 8
   Wait: 24-72 hours for Meta approval

5. Complete Meta KYC:
   AiSensy Dashboard → Step 2 (PENDING)
   "Get Business Verified (FBM/KYC)"
   Required for: sending beyond 1,000 messages/day

6. Add AiSensy key in PingFlow Settings page:
   Go to: pingflow.pixalara.io/settings
   Enter Campaign API key → Test Connection → Save
```

---

## 12. CODING STANDARDS (Always Follow)

```typescript
// 1. TypeScript strict mode — ZERO any types
// 2. Every async function has try/catch
// 3. Inline styles ONLY for visual properties
// 4. Phone numbers: +91XXXXXXXXXX in Firestore
//                   91XXXXXXXXXX for AiSensy (strip +)
// 5. Dates: store as Firestore Timestamp
//           display with date-fns
//           calculations in IST (Asia/Kolkata)
// 6. Always use existing Modal.tsx
// 7. Always use PrimaryButton/GhostButton/DangerButton
// 8. Firestore: onSnapshot for live data
// 9. Unsubscribe onSnapshot on component unmount
// 10. Cloud Functions: v2 ONLY, region asia-south1
// 11. No hardcoded API keys — always .env
// 12. Console.log: [PingFlow][FileName] message
// 13. Amounts stored as numbers in rupees (no paise)
// 14. Invoice counter: Firestore transaction (atomic)
// 15. GST: Math.round(subtotal * gstRate) / 100

// IST timezone helper:
const nowIST = new Date(
  new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Kolkata' 
  })
);
```

---

## 13. PAGES ROUTING (App.tsx)

```typescript
// Current routes:
/              → Landing page (index.html)
/login         → Login.tsx
/onboarding    → Onboarding.tsx
/dashboard     → Dashboard.tsx (auth required)
/members       → Members.tsx (auth required)
/members/:id   → MemberDetail.tsx (auth required)
/plans         → Plans.tsx (auth required)
/automations   → AutomationLogs.tsx (auth required) ← Phase 3
/billing       → Billing.tsx (auth required) ← Phase 4
/campaigns     → Campaigns.tsx (auth required) ← Phase 5
/settings      → Settings.tsx (auth required)
```

---

## 14. CURRENT INFRA COSTS

```
Firebase Hosting:     ₹0  (free tier — tiny static files)
Firebase Firestore:   ₹0  (free tier — < 50K reads/day)
Firebase Auth:        ₹0  (free tier — Google OAuth)
Firebase Functions:   ₹0  (free tier — 2M invocations/mo)
Vercel (if added):    ₹0  (free tier — 100GB bandwidth)
AiSensy WhatsApp:   ₹1,500/mo (Free Forever platform)
                    + ₹0.125/utility message
                    + ₹1.09/marketing message
Domain (pixalara.io): ~₹83/mo (annual)
                      
TOTAL: ~₹1,583/month

Revenue needed to break even: 2 gyms @ ₹999/mo
Revenue at 10 gyms: ₹9,990/mo (84% margin)
Revenue at 50 gyms: ₹49,950/mo (97% margin)
```

---

## 15. HOW TO CONTINUE DEVELOPMENT

### For each new phase, tell Gemini:
```
"Read the PingFlow project context document completely.
Current status: Phase X is complete and deployed.
Now build Phase Y.
Read all existing files first.
Output complete files only — no placeholders.
Follow all coding standards in Section 12.
Match the design system in Section 3 exactly."
```

### Deploy after each phase:
```bash
# Frontend changes:
cd frontend
npm run build
firebase deploy --only hosting

# Function changes:
cd functions
npm run build
firebase deploy --only functions

# Schema changes:
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

### Test checklist after each deploy:
```
[ ] pingflow.pixalara.io loads correctly
[ ] Google login works
[ ] New features visible in nav
[ ] No console errors
[ ] Firestore reads/writes working
[ ] Mobile layout acceptable
```

---

## 16. KNOWN ISSUES & DECISIONS

```
1. Tailwind overrides inline styles on some components
   Decision: Use inline styles exclusively for all visual
   properties. Tailwind only for flex/grid utilities.

2. Inactivity flow removed from Phase 3
   Reason: Indian gyms don't maintain attendance records
   Future: Add optional "Mark Attendance" button in v2

3. WCC Balance low (₹50)
   Action: Recharge ₹500 before testing Phase 3

4. Meta KYC pending
   Impact: Limited to 1,000 messages/day until verified
   Action: Complete verification in AiSensy dashboard

5. Phone OTP auth built but not primary
   Decision: Google OAuth is primary for MVP
   Reason: Simpler onboarding for gym owners

6. PDF generation uses browser print()
   Reason: Zero external dependencies
   Trade-off: User must use Print → Save as PDF

7. Project API Keys require AiSensy PRO plan
   Decision: Use Campaign API Key (free tier)
   Impact: No difference for our automation use case
```

---

END OF DOCUMENT
Version: 1.0 | April 2026 | PingFlow by Pixalara LLP
