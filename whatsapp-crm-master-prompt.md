# PingFlow — Master Build Prompt
# Paste this as your first message in Firebase Studio / Claude Opus 4.6

---

You are a senior full-stack engineer building a production-grade **PingFlow — a WhatsApp-based CRM for gyms** from scratch. Your job is to build this step-by-step, phase by phase, writing complete, working code — no placeholders, no TODOs.

---

## 🧠 Product Context

This is a **revenue automation system** for small/medium gym owners in India. It automates member lifecycle management over WhatsApp — renewal reminders, expiry alerts, and inactivity follow-ups. The goal is to reduce member drop-off and increase renewal rates automatically.

**Target user:** Gym owner in India. Non-technical. Needs setup in under 10 minutes.
**Core promise:** "Turn this on and automatically recover lost members."

---

## ⚙️ Tech Stack (Non-negotiable)

| Layer               | Technology                                      |
|---------------------|-------------------------------------------------|
| Frontend            | React 18 + TypeScript + Vite                    |
| Styling             | Tailwind CSS v3 + shadcn/ui                     |
| Database            | Firebase Firestore (NoSQL)                      |
| Authentication      | Firebase Auth — Phone OTP (primary)             |
| Backend/API         | Firebase Cloud Functions v2 (Node.js/TypeScript)|
| Automation          | Google Cloud Scheduler → Cloud Functions        |
| WhatsApp            | WATI API (abstracted behind a service layer)    |
| Deployment          | Vercel (frontend) + Firebase (functions)        |
| State Management    | Zustand                                         |
| Forms               | React Hook Form + Zod validation                |
| Date handling       | date-fns                                        |

---

## 📁 Project Structure

```
pingflow/
├── frontend/                        # Vite + React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── members/             # Member-related components
│   │   │   ├── plans/               # Plan management components
│   │   │   ├── campaigns/           # Broadcast campaign components
│   │   │   └── layout/              # Sidebar, Navbar, Shell
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Members.tsx
│   │   │   ├── MemberDetail.tsx
│   │   │   ├── Plans.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── AutomationLogs.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # Firebase + API calls
│   │   │   ├── firebase.ts          # Firebase init
│   │   │   ├── members.service.ts
│   │   │   ├── plans.service.ts
│   │   │   └── campaigns.service.ts
│   │   ├── store/                   # Zustand stores
│   │   ├── types/                   # TypeScript interfaces
│   │   │   └── index.ts
│   │   └── lib/
│   │       └── utils.ts
│   ├── .env.local
│   └── vite.config.ts
│
├── functions/                       # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                 # Function exports
│   │   ├── automation/
│   │   │   ├── expiryChecker.ts     # Daily expiry logic
│   │   │   └── inactivityChecker.ts # Inactivity logic
│   │   ├── whatsapp/
│   │   │   ├── wati.service.ts      # WATI API abstraction
│   │   │   └── templates.ts         # Message templates
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

---

## 🗃️ Firestore Schema

### Collection: `gyms/{gymId}`
```typescript
{
  name: string;
  ownerName: string;
  phone: string;
  watiApiKey: string;        // encrypted
  watiApiEndpoint: string;
  createdAt: Timestamp;
  isActive: boolean;
}
```

### Collection: `gyms/{gymId}/members/{memberId}`
```typescript
{
  name: string;
  phone: string;             // E.164 format: +91XXXXXXXXXX
  planId: string;
  planName: string;          // Duplicated for fast reads
  startDate: Timestamp;
  endDate: Timestamp;
  lastVisitDate: Timestamp | null;
  status: 'active' | 'expired' | 'expiring_soon' | 'inactive';
  endDateUnix: number;       // Unix timestamp for range queries
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `gyms/{gymId}/plans/{planId}`
```typescript
{
  name: string;              // e.g., "Monthly", "Quarterly"
  durationDays: number;
  price: number;             // INR
  isActive: boolean;
  createdAt: Timestamp;
}
```

### Collection: `gyms/{gymId}/automationLogs/{logId}`
```typescript
{
  memberId: string;
  memberName: string;
  memberPhone: string;
  eventType: 'expiry_reminder_d3' | 'expiry_alert_d0' | 'expiry_followup_d2' | 'inactivity_d5' | 'inactivity_d10';
  messageStatus: 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
  templateName: string;
  timestamp: Timestamp;
}
```

### Collection: `gyms/{gymId}/campaigns/{campaignId}`
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

---

## 🔍 Firestore Composite Indexes (firestore.indexes.json)

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
    }
  ]
}
```

---

## 🔐 Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gyms/{gymId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == gymId;
    }
  }
}
```

---

## 🤖 Automation Logic (Cloud Functions)

### Daily Job — Expiry Checker (`expiryChecker.ts`)

Triggered by Cloud Scheduler every day at 9:00 AM IST (`0 3 * * *` UTC).

Logic:
```
today = current date (IST)

Query members where:
  - endDateUnix BETWEEN (today - 2 days) AND (today + 3 days)

For each member:
  - daysUntilExpiry = endDate - today

  - if daysUntilExpiry == 3  → send template: EXPIRY_REMINDER_D3
  - if daysUntilExpiry == 0  → send template: EXPIRY_ALERT_D0
  - if daysUntilExpiry == -2 → send template: EXPIRY_FOLLOWUP_D2

  - Check automationLogs: skip if same eventType already sent today for this member
  - Log result to automationLogs collection
```

### Daily Job — Inactivity Checker (`inactivityChecker.ts`)

Logic:
```
today = current date (IST)

Query members where:
  - status == 'active'
  - lastVisitDate is not null

For each member:
  - daysSinceVisit = today - lastVisitDate

  - if daysSinceVisit == 5  → send template: INACTIVITY_D5
  - if daysSinceVisit == 10 → send template: INACTIVITY_D10

  - Dedup check via automationLogs before sending
```

---

## 📱 WhatsApp Message Templates (WATI)

Create these templates in WATI dashboard. Use these exact names in code:

| Template Name           | Trigger         | Message                                                                                     |
|-------------------------|-----------------|---------------------------------------------------------------------------------------------|
| `gym_expiry_reminder`   | D-3             | "Hi {{1}}, your membership at {{2}} expires in 3 days on {{3}}. Renew now to keep your streak! Reply YES to confirm renewal." |
| `gym_expiry_alert`      | D0              | "Hi {{1}}, your membership at {{2}} has expired today. Don't let your fitness journey stop! Contact us to renew." |
| `gym_expiry_followup`   | D+2             | "Hi {{1}}, we miss you at {{2}}! Your membership expired 2 days ago. We have a special offer waiting for you. Reply to know more." |
| `gym_inactivity_5d`     | 5 days inactive | "Hi {{1}}, we noticed you haven't visited {{2}} in 5 days. Your body misses the gym! Come back strong." |
| `gym_inactivity_10d`    | 10 days inactive| "Hi {{1}}, it's been 10 days since your last visit to {{2}}. We're here to support you — reply and let's get you back on track." |

---

## 🎨 UI Design System

**Theme:** Clean, modern, dark-accented SaaS dashboard. Professional but not corporate. Inspired by Linear and Vercel dashboards.

**Colors:**
```css
--primary: #16a34a;      /* Green — growth, fitness */
--primary-dark: #15803d;
--background: #0f172a;   /* Dark navy */
--surface: #1e293b;
--surface-2: #334155;
--text-primary: #f8fafc;
--text-muted: #94a3b8;
--danger: #ef4444;
--warning: #f59e0b;
--success: #22c55e;
```

**Typography:** `Geist` (Vercel's font) — import from Google Fonts.

**Dashboard Cards:** Show stats with trend indicators. Use subtle green glow on active member count.

**Status Badges:**
- `active` → green
- `expiring_soon` (≤ 3 days) → amber
- `expired` → red
- `inactive` → slate

---

## 📊 Dashboard Metrics

Show 4 stat cards:
1. **Total Members**
2. **Active Members** (status = active)
3. **Expiring Soon** (status = expiring_soon or endDate within 3 days)
4. **Expired** (status = expired)

Below cards, show:
- **Members expiring in next 7 days** — sortable table
- **Recent automation logs** — last 10 entries

---

## 🏗️ Build Phases

### Phase 1 — Foundation
- [ ] Initialize Firebase project + Vite React app
- [ ] Configure Firebase Auth (Phone OTP)
- [ ] Set up Firestore collections + security rules
- [ ] Deploy composite indexes
- [ ] Build login/onboarding screen (gym registration)

### Phase 2 — Core CRUD
- [ ] Plans management (add/edit/delete plans)
- [ ] Members management (add/edit/delete members)
- [ ] Member status auto-calculation on write
- [ ] Dashboard with live Firestore listeners

### Phase 3 — Automation Engine
- [ ] WATI service layer (`wati.service.ts`)
- [ ] Expiry checker Cloud Function
- [ ] Inactivity checker Cloud Function
- [ ] Cloud Scheduler setup (9 AM IST daily)
- [ ] AutomationLogs viewer in UI

### Phase 4 — Broadcast Campaigns
- [ ] Campaign creation form
- [ ] Target group filtering
- [ ] Campaign execution Cloud Function (HTTP callable)
- [ ] Campaign status tracking

### Phase 5 — Settings & Polish
- [ ] Settings page (WATI API key config)
- [ ] Onboarding checklist for new gym owners
- [ ] Empty states with CTAs
- [ ] Error boundaries + toast notifications

---

## 🧱 Code Standards

- **TypeScript strict mode** — no `any`, define all interfaces in `types/index.ts`
- **Error handling** — every async function has try/catch with user-friendly error messages
- **Loading states** — every data fetch shows a skeleton loader, not a spinner
- **Optimistic UI** — member status updates reflect instantly before Firestore confirms
- **Phone numbers** — always store and send in E.164 format (+91XXXXXXXXXX)
- **Dates** — always store as Firestore Timestamps. Use `date-fns` for display formatting
- **Environment variables** — all Firebase config and API keys in `.env.local`, never hardcoded
- **Cloud Functions** — use v2 functions (`onSchedule`, `onCall`). Always set region to `asia-south1`

---

## 🌐 Environment Variables

### Frontend (.env.local)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Functions (.env)
```
WATI_API_ENDPOINT=https://live-server-XXXXX.wati.io
WATI_API_KEY=your_bearer_token
```

---

## 🚀 Start Here

Begin with **Phase 1**. For each phase:

1. Write all files completely — no partial code
2. Include all imports
3. Show the exact terminal commands to run
4. Confirm what to test before moving to the next phase

Start by generating:
1. `firebase.json` + `.firebaserc`
2. `firestore.rules`
3. `firestore.indexes.json`
4. Frontend `src/types/index.ts` — all TypeScript interfaces
5. `src/services/firebase.ts` — Firebase initialization
6. Login page with Phone OTP flow

Ask me before moving to Phase 2.
