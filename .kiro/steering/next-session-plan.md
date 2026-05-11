# PingFlow — Next Session Implementation Plan
# Date: April 29, 2026
# Priority: Pending items + Polish

---

## CONTEXT FOR THE NEXT SESSION

PingFlow is a WhatsApp-based Gym CRM deployed at https://pingflow.pixalara.io
Firebase Project: pingflow-da311 | Region: asia-south1

### What was built in this session (massive scope):

#### Subscription & Pricing System
1. Plan config (trial/starter/pro) with limits and features
2. usePlan hook with canAccess/isAtLimit
3. PlanGuard + UpgradeModal components
4. Sidebar/BranchSwitcher plan gating
5. Resource limit enforcement (members/employees/branches)
6. Expense tracking module (Pro only)
7. Landing page pricing section with monthly/yearly toggle
8. Signup defaults (plan: trial, 14-day trial with Pro access)
9. Firestore security rules for expenses

#### Employee Roles & Permissions
10. 5 granular roles: admin, branch_manager, trainer, sales_executive, receptionist
11. Centralized permissionMap.ts with can(action, resource) API
12. PageGuard component wrapping all routes
13. Sidebar filtering by role permissions
14. Action-level button gating (Members, MemberDetail)
15. Employee create/edit with role dropdown + single branch assignment
16. Employee delete with OTP authentication
17. Legacy role migration (manager→branch_manager, employee→receptionist)

#### Lead Management System
18. Full lead pipeline: New → Contacted → Trial Scheduled → Trial Done → Negotiation → Converted → Lost
19. Branch-scoped leads at gyms/{gymId}/branches/{branchId}/leads
20. Lead CRUD service with audit trail
21. Trainer privacy filtering
22. Claim Lead action
23. Quick status change dropdown on lead cards
24. Convert to Member flow with plan selection
25. WhatsApp quick action via sendLeadWhatsApp Cloud Function
26. Phone masking (98******01)
27. Conversion Heatmap analytics (Pro only)
28. Plan gating: 50 active leads for starter/trial, unlimited for pro

#### Security & Audit
29. OTP-protected delete for members (WhatsApp verification)
30. OTP-protected delete for employees
31. Logout audit logging with gym name
32. Activity Log page with date filters, stats, timeline view
33. Branch name resolution in audit logs

#### Analytics & Dashboard
34. Analytics page with revenue vs expenses charts, profit trend, category breakdown
35. Record Payment on MemberDetail page
36. Member status calculation fix (inactivity threshold 10 days, expiring 7 days)

#### Landing Page & Marketing
37. Interactive dashboard preview with 13 clickable modules
38. Social proof stats section (500+ gyms, 50K+ messages, ₹2Cr+ recovered)
39. Before vs After PingFlow comparison
40. Testimonials section
41. Final CTA banner
42. Book a Demo page with Web3Forms integration (fcd8310c-f05c-4b4f-ba0f-42a269b7ea9d)
43. Privacy Policy, Terms of Service, Refund Policy pages
44. Social media links (LinkedIn, X, Instagram, YouTube)
45. Legal section in footer
46. "Crafted with ❤️ by Pixalara" footer text

#### Performance & Responsive
47. Code splitting via React.lazy (initial bundle 1063KB → 340KB)
48. Debounced useResponsive hook
49. Mobile-responsive modal, pages, and interactive dashboard
50. Global responsive CSS utilities

### Current State
- All features deployed and live at https://pingflow.pixalara.io
- 16 Cloud Functions deployed (including sendLeadWhatsApp, deleteEmployee)
- Firestore rules updated for leads, expenses, demoRequests
- Interactive dashboard on landing page has all 13 modules

---

## PENDING ITEMS FOR NEXT SESSION

### 1. Golden Gym Logo
- User provided a Golden Gym logo image (gold bodybuilder with dumbbells)
- Save it as `frontend/public/golden-gym-logo.png`
- It's referenced in the InteractiveDashboard Settings view
- Redeploy after saving

### 2. Book Demo Page — Mobile Responsive
- The book demo page grid (form + date picker) needs `className="lp-demo-grid"` for CSS responsive override
- Currently stacks on mobile via CSS but verify it works

### 3. Node.js Runtime Upgrade
- Firebase warns: "Runtime Node.js 20 will be deprecated on 2026-04-30"
- Need to upgrade to Node.js 22 in functions/package.json

### 4. Firebase Tools Update
- Current: 15.14.0, Available: 15.15.0
- Run: `npm install -g firebase-tools`

---

## KEY FILES REFERENCE

### Backend (functions/src/)
- index.ts — exports all Cloud Functions (16 total)
- automation/expiryChecker.ts — 3-stage D-3/D-0/D+2 automation
- automation/inactivityChecker.ts — D-5/D-10 inactivity alerts
- whatsapp/aisensy.service.ts — AiSensy API wrapper
- whatsapp/templates.ts — template name constants
- whatsapp/sendLeadWhatsApp.ts — WhatsApp quick action for leads
- ai/broadcastAssistant.ts — Vertex AI Gemini integration
- auth/employeeManager.ts — create/delete employee accounts
- auth/otpVerification.ts — dual OTP + WhatsApp-only OTP
- broadcast/sendBroadcast.ts — broadcast messaging

### Frontend (frontend/src/)
- config/planConfig.ts — plan types, limits, features, prices
- config/permissionMap.ts — role-based permissions (13 resources)
- hooks/useAuth.ts — auth state + profile resolution
- hooks/useRole.ts — RBAC with can(action, resource) + resolveRole
- hooks/useBranch.ts — branch data path resolution
- hooks/usePlan.ts — plan access with trial expiry logic
- hooks/useWallet.ts — real-time wallet balance
- hooks/useResponsive.ts — debounced responsive breakpoints
- store/authStore.ts — Zustand store
- services/leads.service.ts — lead CRUD (branch-scoped)
- services/members.service.ts — member CRUD (branch-scoped)
- services/plans.service.ts — plan CRUD (branch-scoped)
- services/billing.service.ts — payment CRUD (branch-scoped)
- services/audit.service.ts — audit trail logging (22 action types)
- services/expense.service.ts — expense CRUD
- services/wallet.service.ts — wallet operations
- services/branch.service.ts — branch CRUD
- services/whatsapp.service.ts — frontend WhatsApp + AI callables
- components/ui/InteractiveDashboard.tsx — landing page interactive demo (13 modules)
- components/ui/OtpProtectedConfirm.tsx — WhatsApp OTP verification for destructive actions
- components/ui/PlanGuard.tsx — feature gating wrapper
- components/ui/UpgradeModal.tsx — upgrade prompt
- components/layout/PageGuard.tsx — page-level access control
- components/layout/Sidebar.tsx — permission-map-driven nav
- components/layout/AppShell.tsx — main app layout
- pages/Leads.tsx — lead pipeline with status tabs, heatmap
- pages/Analytics.tsx — revenue/expenses/profit charts
- pages/Expenses.tsx — expense tracking (Pro only)
- pages/ActivityLog.tsx — audit trail with date filters
- pages/BookDemo.tsx — demo booking with Web3Forms
- pages/Privacy.tsx, Terms.tsx, Refund.tsx — legal pages
- lib/utils.ts — formatPhoneE164, maskPhone, cn

### Environment
- functions/.env — AISENSY_API_KEY, SMTP_EMAIL, SMTP_PASSWORD
- Firebase Project: pingflow-da311
- AiSensy Templates: gym_expiry_reminder_d3, gym_expiry_reminder_d0, gym_expiry_reminder_p2, pingflow_otp_verification
- Zoho SMTP: smtp.zoho.in:465, DKIM verified for pixalara.com
- Web3Forms API Key: fcd8310c-f05c-4b4f-ba0f-42a269b7ea9d (demo bookings → pingflow.sales@pixalara.com)

### Roles & Permissions
- admin: full access to everything
- branch_manager: members, leads, plans, billing, automations, broadcast, activity (full CRUD)
- trainer: dashboard, members (read+checkin), leads (full CRUD)
- sales_executive: dashboard, members (create+read), leads (full CRUD), billing (create+read)
- receptionist: dashboard, members (read+checkin), leads (full CRUD), plans (read)

### Plan Tiers
- trial: Pro-level access for 14 days, then downgrades to starter limits
- starter (₹499/mo): 100 members, 2 employees, 1 branch, 50 leads
- pro (₹999/mo): unlimited everything + broadcast, expenses, analytics, globalView, leads_analytics

---

## DEPLOYMENT COMMANDS

```bash
# Build and deploy functions
cd functions && rm -rf lib && npm run build && cd .. && firebase deploy --only functions

# Build and deploy frontend
cd frontend && npm run build && cd .. && firebase deploy --only hosting

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy everything
firebase deploy --only functions,hosting,firestore:rules

# Check function logs
firebase functions:log --only sendLeadWhatsApp
firebase functions:log --only deleteEmployee
```
